import java.io.*;

/**
 * Converte arquivos .dbc do DATASUS em .dbf.
 * Formato .dbc: cabeçalho DBF original + CRC32 (4 bytes) + registros comprimidos com
 * PKWare DCL implode. O descompressor é um port de blast.c (Mark Adler, zlib/contrib).
 *
 * Uso: java coleta/Dbc2Dbf.java entrada.dbc saida.dbf   (saida "-" = stdout)
 */
public class Dbc2Dbf {
    static final int MAXBITS = 13, MAXWIN = 4096;

    final InputStream in;
    final OutputStream out;
    int bitbuf = 0, bitcnt = 0;
    final byte[] win = new byte[MAXWIN];
    int next = 0;
    boolean first = true;

    Dbc2Dbf(InputStream in, OutputStream out) { this.in = in; this.out = out; }

    int bits(int need) throws IOException {
        int val = bitbuf;
        while (bitcnt < need) {
            int b = in.read();
            if (b < 0) throw new EOFException("fim inesperado dos dados comprimidos");
            val |= b << bitcnt;
            bitcnt += 8;
        }
        bitbuf = val >>> need;
        bitcnt -= need;
        return val & ((1 << need) - 1);
    }

    static final class Huffman {
        final short[] count = new short[MAXBITS + 1];
        final short[] symbol = new short[256];
    }

    static Huffman construct(int[] rep) {
        Huffman h = new Huffman();
        int[] length = new int[256];
        int n = 0;
        for (int r : rep) {
            int left = (r >> 4) + 1, len = r & 15;
            while (left-- > 0) length[n++] = len;
        }
        for (int s = 0; s < n; s++) h.count[length[s]]++;
        short[] offs = new short[MAXBITS + 1];
        for (int len = 1; len < MAXBITS; len++) offs[len + 1] = (short) (offs[len] + h.count[len]);
        for (int s = 0; s < n; s++)
            if (length[s] != 0) h.symbol[offs[length[s]]++] = (short) s;
        return h;
    }

    int decode(Huffman h) throws IOException {
        int code = 0, first = 0, index = 0;
        for (int len = 1; len <= MAXBITS; len++) {
            code |= bits(1) ^ 1; // códigos gravados com bits invertidos
            int count = h.count[len];
            if (code < first + count) return h.symbol[index + (code - first)];
            index += count;
            first = (first + count) << 1;
            code <<= 1;
        }
        throw new IOException("código Huffman inválido");
    }

    static final Huffman LIT = construct(new int[]{
        11, 124, 8, 7, 28, 7, 188, 13, 76, 4, 10, 8, 12, 10, 12, 10, 8, 23, 8,
        9, 7, 6, 7, 8, 7, 6, 55, 8, 23, 24, 12, 11, 7, 9, 11, 12, 6, 7, 22, 5,
        7, 24, 6, 11, 9, 6, 7, 22, 7, 11, 38, 7, 9, 8, 25, 11, 8, 11, 9, 12,
        8, 12, 5, 38, 5, 38, 5, 11, 7, 5, 6, 21, 6, 10, 53, 8, 7, 24, 10, 27,
        44, 253, 253, 253, 252, 252, 252, 13, 12, 45, 12, 45, 12, 61, 12, 45,
        44, 173});
    static final Huffman LEN = construct(new int[]{2, 35, 36, 53, 38, 23});
    static final Huffman DIST = construct(new int[]{2, 20, 53, 230, 247, 151, 248});
    static final int[] BASE = {3, 2, 4, 5, 6, 7, 8, 9, 10, 12, 16, 24, 40, 72, 136, 264};
    static final int[] EXTRA = {0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8};

    void put(byte b) throws IOException {
        win[next++] = b;
        if (next == MAXWIN) {
            out.write(win, 0, MAXWIN);
            next = 0;
            first = false;
        }
    }

    void decomp() throws IOException {
        int lit = bits(8);
        if (lit > 1) throw new IOException("cabeçalho DCL inválido (literal)");
        int dict = bits(8);
        if (dict < 4 || dict > 6) throw new IOException("cabeçalho DCL inválido (dicionário)");
        while (true) {
            if (bits(1) == 1) {
                int sym = decode(LEN);
                int len = BASE[sym] + bits(EXTRA[sym]);
                if (len == 519) break; // código de fim
                int shift = len == 2 ? 2 : dict;
                int dist = (decode(DIST) << shift) + bits(shift) + 1;
                if (first && dist > next) throw new IOException("distância inválida");
                while (len-- > 0) put(win[(next - dist) & (MAXWIN - 1)]);
            } else {
                put((byte) (lit == 1 ? decode(LIT) : bits(8)));
            }
        }
        out.write(win, 0, next);
    }

    public static void main(String[] args) throws IOException {
        if (args.length != 2) {
            System.err.println("uso: java Dbc2Dbf.java entrada.dbc saida.dbf");
            System.exit(2);
        }
        OutputStream destino = args[1].equals("-") ? System.out : new FileOutputStream(args[1]);
        try (InputStream in = new BufferedInputStream(new FileInputStream(args[0]), 1 << 20);
             OutputStream out = new BufferedOutputStream(destino, 1 << 20)) {
            byte[] head = in.readNBytes(10);
            int headerSize = (head[8] & 0xff) | (head[9] & 0xff) << 8;
            out.write(head);
            out.write(in.readNBytes(headerSize - 10));
            in.readNBytes(4); // CRC32
            new Dbc2Dbf(in, out).decomp();
        }
    }
}
