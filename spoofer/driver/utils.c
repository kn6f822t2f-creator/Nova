#include "spoofer.h"
#include <ntstrsafe.h>

SPOOF_RNG g_Rng;

void Rng_Init(PSPOOF_RNG rng) {
    LARGE_INTEGER t;
    KeQuerySystemTime(&t);
    rng->state[0] = (ULONGLONG)t.QuadPart ^ 0xdeadbeefcafe1234ULL;
    rng->state[1] = rng->state[0] * 6364136223846793005ULL + 1442695040888963407ULL;
    rng->state[2] = rng->state[1] * 6364136223846793005ULL + 1442695040888963407ULL;
    rng->state[3] = rng->state[2] * 6364136223846793005ULL + 1442695040888963407ULL;
}

static ULONGLONG rotl64(ULONGLONG x, int k) {
    return (x << k) | (x >> (64 - k));
}

ULONGLONG Rng_Next(PSPOOF_RNG rng) {
    const ULONGLONG result = rotl64(rng->state[1] * 5, 7) * 9;
    const ULONGLONG t = rng->state[1] << 17;
    rng->state[2] ^= rng->state[0];
    rng->state[3] ^= rng->state[1];
    rng->state[1] ^= rng->state[2];
    rng->state[0] ^= rng->state[3];
    rng->state[2] ^= t;
    rng->state[3] = rotl64(rng->state[3], 45);
    return result;
}

void Gen_Serial(PCHAR out, ULONG len) {
    static const CHAR charset[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (ULONG i = 0; i < len; i++)
        out[i] = charset[Rng_Next(&g_Rng) % (sizeof(charset) - 1)];
    out[len] = '\0';
}

void Gen_Mac(PUCHAR mac) {
    ULONGLONG r = Rng_Next(&g_Rng);
    mac[0] = (UCHAR)(r >> 0) & 0xFE;
    mac[0] |= 0x02;
    mac[1] = (UCHAR)(r >> 8);
    mac[2] = (UCHAR)(r >> 16);
    mac[3] = (UCHAR)(r >> 24);
    mac[4] = (UCHAR)(r >> 32);
    mac[5] = (UCHAR)(r >> 40);
}

void Gen_Guid(PUCHAR guid16) {
    ULONGLONG lo = Rng_Next(&g_Rng);
    ULONGLONG hi = Rng_Next(&g_Rng);
    RtlCopyMemory(guid16,     &lo, 8);
    RtlCopyMemory(guid16 + 8, &hi, 8);
    guid16[6] = (guid16[6] & 0x0F) | 0x40;
    guid16[8] = (guid16[8] & 0x3F) | 0x80;
}

void Gen_GuidStr(PWCHAR out, ULONG maxChars) {
    UCHAR g[16];
    Gen_Guid(g);
    if (maxChars < 39) return;
    RtlStringCchPrintfW(out, maxChars,
        L"{%02X%02X%02X%02X-%02X%02X-%02X%02X-%02X%02X-%02X%02X%02X%02X%02X%02X}",
        g[0],g[1],g[2],g[3], g[4],g[5], g[6],g[7],
        g[8],g[9], g[10],g[11],g[12],g[13],g[14],g[15]);
}
