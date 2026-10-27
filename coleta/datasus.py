"""Coleta microdados do FTP do DATASUS e guarda só os registros da Serra da Ibiapaba.

Fluxo por arquivo: baixa o .dbc -> descomprime com coleta/Dbc2Dbf.java direto para um pipe ->
filtra os registros pelos códigos IBGE (residência OU ocorrência/atendimento) -> grava Parquet.
Nenhum .dbf descomprimido toca o disco (o SINAN nacional passa de vários GB).

Uso:
  .venv/Scripts/python coleta/datasus.py                          # SIM, SINASC, SIH, SINAN 2019-2026
  .venv/Scripts/python coleta/datasus.py --sistemas SIH --inicio 2024
  .venv/Scripts/python coleta/datasus.py --sistemas SIA --inicio 2025 --fim 2025   # pesado: ~80 MB/mês
  .venv/Scripts/python coleta/datasus.py --incremental            # só o que mudou no FTP desde o manifesto

Saída: data/datasus/<SISTEMA>/<ARQUIVO>.parquet      registros completos da Ibiapaba
       data/datasus_ce/<SISTEMA>/<ARQUIVO>.parquet   colunas reduzidas, todos os residentes do CE
       data/datasus/manifesto.json
Arquivos já processados com o mesmo tamanho/data no FTP são pulados (preliminares são
re-baixados automaticamente quando o DATASUS os atualiza).

--incremental: pula os arquivos que estão no manifesto com o mesmo tamanho/data mesmo que o Parquet não esteja no
disco. É o modo da atualização automática: o manifesto e as contagens agregadas (data/agregados) ficam no git, e
indicadores/construir.py só recalcula os arquivos baixados nesta execução.
"""
import argparse
import datetime as dt
import ftplib
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

RAIZ = Path(__file__).resolve().parent.parent
FTP_HOST = "ftp.datasus.gov.br"
SAIDA = RAIZ / "data" / "datasus"
CACHE = RAIZ / "data" / "cache" / "datasus"
BUILD = RAIZ / "data" / "cache" / "bin"
MANIFESTO = SAIDA / "manifesto.json"

SAIDA_CE = RAIZ / "data" / "datasus_ce"

# arquivos(ano) -> nomes candidatos; pastas em ordem de preferência (definitivo antes de preliminar);
# campos de filtro: o 1º é sempre o município de residência.
# colunas_ce: base reduzida de TODOS os residentes do Ceará, usada nos indicadores e na referência estadual.
SISTEMAS = {
    "SIM": {
        "pastas": ["/dissemin/publicos/SIM/CID10/DORES", "/dissemin/publicos/SIM/PRELIM/DORES"],
        "arquivos": lambda ano: [f"DOCE{ano}.dbc"],
        "campos": ["CODMUNRES", "CODMUNOCOR"],
        "colunas_ce": ["CODMUNRES", "CODMUNOCOR", "DTOBITO", "IDADE", "SEXO", "CAUSABAS"],
    },
    "SINASC": {
        "pastas": ["/dissemin/publicos/SINASC/1996_/Dados/DNRES", "/dissemin/publicos/SINASC/PRELIM/DNRES"],
        "arquivos": lambda ano: [f"DNCE{ano}.dbc"],
        "campos": ["CODMUNRES", "CODMUNNASC"],
        "colunas_ce": ["CODMUNRES", "CODMUNNASC", "DTNASC", "PESO", "PARTO", "CONSPRENAT", "MESPRENAT",
                       "IDADEMAE", "GESTACAO", "SEMAGESTAC"],
    },
    "SIH": {  # AIH reduzida (internações)
        "pastas": ["/dissemin/publicos/SIHSUS/200801_/Dados"],
        "arquivos": lambda ano: [f"RDCE{ano % 100:02d}{m:02d}.dbc" for m in range(1, 13)],
        "campos": ["MUNIC_RES", "MUNIC_MOV"],
        "colunas_ce": ["MUNIC_RES", "MUNIC_MOV", "ANO_CMPT", "MES_CMPT", "DIAG_PRINC", "IDADE", "COD_IDADE",
                       "SEXO", "MORTE", "VAL_TOT", "DIAS_PERM"],
    },
    "SINAN": {  # arquivos nacionais: dengue, chikungunya, zika
        "pastas": ["/dissemin/publicos/SINAN/DADOS/FINAIS", "/dissemin/publicos/SINAN/DADOS/PRELIM"],
        "arquivos": lambda ano: [f"{a}BR{ano % 100:02d}.dbc" for a in ("DENG", "CHIK", "ZIKA")],
        "campos": ["ID_MN_RESI", "ID_MUNICIP"],
        "colunas_ce": ["ID_MN_RESI", "ID_MUNICIP", "NU_ANO", "SEM_PRI", "DT_SIN_PRI", "CLASSI_FIN",
                       "EVOLUCAO", "HOSPITALIZ"],
    },
    "SIA": {  # produção ambulatorial — opcional, arquivos grandes
        "pastas": ["/dissemin/publicos/SIASUS/200801_/Dados"],
        "arquivos": lambda ano: [f"PACE{ano % 100:02d}{m:02d}.dbc" for m in range(1, 13)],
        "campos": ["PA_MUNPCN", "PA_UFMUN"],
        "colunas_ce": [],
    },
}
PADRAO = ["SIM", "SINASC", "SIH", "SINAN"]


def municipios():
    cfg = json.loads((RAIZ / "config" / "municipios_ibiapaba.json").read_text(encoding="utf-8"))
    return {m["ibge6"] for m in cfg["nucleo"]}


# ---------------------------------------------------------------- FTP

class Ftp:
    def __init__(self):
        self.con = None
        self.listagens = {}

    def conectar(self):
        if self.con is None:
            self.con = ftplib.FTP(FTP_HOST, timeout=120)
            self.con.login()
        return self.con

    def resetar(self):
        try:
            if self.con:
                self.con.close()
        finally:
            self.con = None

    def listar(self, pasta):
        """{NOME_MAIUSCULO: (nome_real, tamanho, data)} — formato de listagem do IIS."""
        if pasta not in self.listagens:
            linhas = []
            self.repetir(lambda: self.conectar().dir(pasta, linhas.append))
            itens = {}
            for ln in linhas:
                m = re.match(r"(\S+)\s+(\S+)\s+(\d+)\s+(.+)$", ln)
                if m:
                    itens[m.group(4).strip().upper()] = (m.group(4).strip(), int(m.group(3)), f"{m.group(1)} {m.group(2)}")
            self.listagens[pasta] = itens
        return self.listagens[pasta]

    def baixar(self, caminho, destino):
        destino.parent.mkdir(parents=True, exist_ok=True)
        parcial = destino.with_suffix(".part")

        def tarefa():
            with open(parcial, "wb") as f:
                self.conectar().retrbinary(f"RETR {caminho}", f.write, blocksize=1 << 16)
        self.repetir(tarefa)
        parcial.replace(destino)

    def repetir(self, fn, tentativas=4):
        for i in range(tentativas):
            try:
                return fn()
            except (ftplib.all_errors) as e:
                if i == tentativas - 1:
                    raise
                print(f"    falha FTP ({e}); tentando de novo...", flush=True)
                self.resetar()
                time.sleep(5 * (i + 1))


# ---------------------------------------------------------------- DBC -> registros filtrados

def classe_java():
    """Compila Dbc2Dbf.java uma vez (javac) para não recompilar a cada arquivo."""
    fonte = RAIZ / "coleta" / "Dbc2Dbf.java"
    classe = BUILD / "Dbc2Dbf.class"
    if not classe.exists() or classe.stat().st_mtime < fonte.stat().st_mtime:
        BUILD.mkdir(parents=True, exist_ok=True)
        subprocess.run(["javac", "-encoding", "UTF-8", "-d", str(BUILD), str(fonte)], check=True)
    return ["java", "-cp", str(BUILD), "Dbc2Dbf"]


def ler_exato(fluxo, n):
    dados = fluxo.read(n)
    return dados if dados is not None else b""


def filtrar_dbc(dbc, campos_filtro, codigos, cmd_java, colunas_ce=()):
    """Lê o DBF que sai do pipe.

    Devolve (colunas, linhas, total_registros, colunas_ce, linhas_ce): `linhas` são os registros completos
    da Ibiapaba; `linhas_ce` são as colunas reduzidas de todos os residentes do Ceará (UF 23).
    """
    proc = subprocess.Popen(cmd_java + [str(dbc), "-"], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            bufsize=1 << 20)
    try:
        fluxo = proc.stdout
        cab = ler_exato(fluxo, 32)
        tam_cab = int.from_bytes(cab[8:10], "little")
        tam_reg = int.from_bytes(cab[10:12], "little")
        desc = ler_exato(fluxo, tam_cab - 32)
        campos, pos = [], 1  # byte 0 do registro = marca de exclusão
        for i in range(0, len(desc), 32):
            d = desc[i:i + 32]
            if not d or d[0] == 0x0D or len(d) < 32:
                break
            campos.append((d[:11].split(b"\0")[0].decode("latin-1").strip(), pos, d[16]))
            pos += d[16]
        nomes = [c[0] for c in campos]
        presentes = [c for c in campos_filtro if c in nomes]
        if not presentes:
            raise RuntimeError(f"nenhum campo de filtro {campos_filtro} em {dbc.name}")
        fatias = [(campos[nomes.index(c)][1], campos[nomes.index(c)][2]) for c in presentes]
        cols_ce = [c for c in colunas_ce if c in nomes]
        fatias_ce = [(campos[nomes.index(c)][1], campos[nomes.index(c)][2]) for c in cols_ce]
        res_pos = fatias[0][0] if presentes[0] == campos_filtro[0] else None

        linhas, linhas_ce, total, lote = [], [], 0, 20000
        while True:
            bloco = ler_exato(fluxo, tam_reg * lote)
            if len(bloco) < tam_reg:
                break
            for i in range(0, len(bloco) - tam_reg + 1, tam_reg):
                reg = bloco[i:i + tam_reg]
                if reg[0] == 0x1A:  # fim de arquivo DBF
                    break
                total += 1
                if reg[0] == 0x2A:  # registro excluído
                    continue
                marcas = [reg[o:o + t].strip()[:6].decode("latin-1") in codigos for o, t in fatias]
                if any(marcas):
                    valores = [reg[o:o + t].decode("latin-1").strip() for _, o, t in campos]
                    linhas.append(valores + marcas)
                if fatias_ce and res_pos is not None and reg[res_pos:res_pos + 2] == b"23":
                    linhas_ce.append([reg[o:o + t].decode("latin-1").strip() for o, t in fatias_ce])
        erro = proc.stderr.read().decode("utf-8", "replace")
        if proc.wait() != 0:
            raise RuntimeError(f"Dbc2Dbf falhou em {dbc.name}: {erro.strip()[:300]}")
        return nomes + [f"_ibiapaba_{c.lower()}" for c in presentes], linhas, total, cols_ce, linhas_ce
    finally:
        if proc.poll() is None:
            proc.kill()


def gravar_parquet(colunas, linhas, destino, arquivo):
    destino.parent.mkdir(parents=True, exist_ok=True)
    dados = {}
    for j, c in enumerate(colunas):
        valores = [ln[j] for ln in linhas]
        dados[c] = pa.array(valores, type=pa.bool_() if c.startswith("_ibiapaba_") else pa.string())
    dados["_arquivo"] = pa.array([arquivo] * len(linhas), type=pa.string())
    pq.write_table(pa.table(dados), destino, compression="zstd")


# ---------------------------------------------------------------- orquestração

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sistemas", nargs="+", default=PADRAO, choices=list(SISTEMAS))
    ap.add_argument("--inicio", type=int, default=2019)
    ap.add_argument("--fim", type=int, default=dt.date.today().year)
    ap.add_argument("--manter-dbc", action="store_true", help="não apagar os .dbc baixados")
    ap.add_argument("--incremental", action="store_true",
                    help="confiar no manifesto: não baixar de novo arquivos inalterados mesmo sem o Parquet local")
    args = ap.parse_args()

    codigos = municipios()
    manifesto = json.loads(MANIFESTO.read_text(encoding="utf-8")) if MANIFESTO.exists() else {}
    ftp, cmd_java = Ftp(), classe_java()
    resumo = []

    for sistema in args.sistemas:
        cfg = SISTEMAS[sistema]
        for ano in range(args.inicio, args.fim + 1):
            for nome in cfg["arquivos"](ano):
                achado = None
                for pasta in cfg["pastas"]:
                    item = ftp.listar(pasta).get(nome.upper())
                    if item:
                        achado = (pasta, *item)
                        break
                if not achado:
                    continue  # ainda não publicado
                pasta, nome_real, tamanho, data_remota = achado
                caminho = f"{pasta}/{nome_real}"
                destino = SAIDA / sistema / (Path(nome_real).stem.upper() + ".parquet")
                destino_ce = SAIDA_CE / sistema / destino.name
                anterior = manifesto.get(caminho)
                inalterado = anterior and anterior["tamanho"] == tamanho and anterior["data_remota"] == data_remota
                if inalterado and (args.incremental or (
                        destino.exists() and (destino_ce.exists() or not cfg["colunas_ce"]))):
                    continue

                dbc = CACHE / sistema / nome_real
                t0 = time.time()
                print(f"[{sistema}] {nome_real} ({tamanho / 1e6:.1f} MB, {'prelim' if 'PRELIM' in pasta else 'final'})",
                      end=" ", flush=True)
                if not dbc.exists() or dbc.stat().st_size != tamanho:
                    ftp.baixar(caminho, dbc)
                colunas, linhas, total, cols_ce, linhas_ce = filtrar_dbc(
                    dbc, cfg["campos"], codigos, cmd_java, cfg["colunas_ce"])
                gravar_parquet(colunas, linhas, destino, nome_real)
                if cols_ce:
                    gravar_parquet(cols_ce, linhas_ce, destino_ce, nome_real)
                if not args.manter_dbc:
                    dbc.unlink()

                # o mesmo arquivo pode ter vindo antes de outra pasta (PRELIM -> definitivo)
                for k in [k for k, m in manifesto.items() if m["arquivo"].upper() == nome_real.upper() and k != caminho]:
                    del manifesto[k]
                manifesto[caminho] = {
                    "sistema": sistema, "arquivo": nome_real, "tamanho": tamanho, "data_remota": data_remota,
                    "preliminar": "PRELIM" in pasta, "registros_total": total, "registros_ibiapaba": len(linhas),
                    "registros_ce": len(linhas_ce),
                    "coletado_em": dt.datetime.now().isoformat(timespec="seconds"),
                }
                SAIDA.mkdir(parents=True, exist_ok=True)
                MANIFESTO.write_text(json.dumps(manifesto, indent=1, ensure_ascii=False), encoding="utf-8")
                resumo.append((sistema, nome_real, total, len(linhas)))
                print(f"-> {len(linhas):,} de {total:,} registros ({time.time() - t0:.0f}s)", flush=True)

    print(f"\n{len(resumo)} arquivo(s) processado(s). Manifesto: {MANIFESTO}")


if __name__ == "__main__":
    sys.exit(main())
