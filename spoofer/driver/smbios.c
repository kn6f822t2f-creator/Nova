#include "spoofer.h"

#pragma pack(push, 1)
typedef struct _SMBIOS3_ENTRY {
    CHAR    Anchor[5];
    UCHAR   Checksum;
    UCHAR   Length;
    UCHAR   MajorVersion;
    UCHAR   MinorVersion;
    UCHAR   Docrev;
    UCHAR   Revision;
    UCHAR   Reserved;
    ULONG64 StructTableAddr;
    ULONG   StructTableMaxLen;
} SMBIOS3_ENTRY;
#pragma pack(pop)

static PSMBIOS_HEADER Smbios_FindType(PVOID base, ULONG tableLen, UCHAR type) {
    PUCHAR p = (PUCHAR)base, end = p + tableLen;
    while (p + sizeof(SMBIOS_HEADER) <= end) {
        PSMBIOS_HEADER hdr = (PSMBIOS_HEADER)p;
        if (hdr->Type == type) return hdr;
        if (hdr->Type == 127) break;
        p += hdr->Length;
        while (p + 1 <= end) {
            if (p[0] == 0 && p[1] == 0) { p += 2; break; }
            p++;
        }
    }
    return NULL;
}

static BOOLEAN Smbios_PatchString(PSMBIOS_HEADER hdr, PUCHAR tableEnd,
                                   UCHAR strIdx, PCSTR newVal) {
    if (strIdx == 0) return FALSE;
    PUCHAR strings = (PUCHAR)hdr + hdr->Length;
    UCHAR  idx = 1;
    while (strings < tableEnd && *strings) {
        SIZE_T slen = strlen((PCSTR)strings);
        if (idx == strIdx) {
            SIZE_T newlen = strlen(newVal);
            if (newlen > slen) newlen = slen;
            RtlCopyMemory(strings, newVal, newlen);
            if (newlen < slen) RtlZeroMemory(strings + newlen, slen - newlen);
            return TRUE;
        }
        strings += slen + 1;
        idx++;
    }
    return FALSE;
}

NTSTATUS Smbios_Patch(void) {
    typedef NTSTATUS (NTAPI *pfnZwQSI)(ULONG, PVOID, ULONG, PULONG);
    UNICODE_STRING funcName = RTL_CONSTANT_STRING(L"ZwQuerySystemInformation");
    pfnZwQSI ZwQSI = (pfnZwQSI)MmGetSystemRoutineAddress(&funcName);
    if (!ZwQSI) return STATUS_NOT_IMPLEMENTED;

    typedef struct {
        ULONG Provider;
        ULONG Action;
        ULONG TableId;
        ULONG BufferLen;
        UCHAR Buffer[1];
    } SFTI;

    ULONG needed = 0;
    SFTI  probe  = {0x52534D42, 0, 0, 0};
    ZwQSI(76, &probe, sizeof(probe), &needed);
    if (needed < sizeof(SFTI)) return STATUS_UNSUCCESSFUL;

    PSFTI info = (PSFTI)ExAllocatePoolWithTag(NonPagedPool, needed, SPOOFER_TAG);
    if (!info) return STATUS_INSUFFICIENT_RESOURCES;
    RtlZeroMemory(info, needed);
    info->Provider  = 0x52534D42;
    info->Action    = 0;
    info->TableId   = 0;
    info->BufferLen = needed - FIELD_OFFSET(SFTI, Buffer);

    NTSTATUS status = ZwQSI(76, info, needed, &needed);
    if (!NT_SUCCESS(status)) { ExFreePoolWithTag(info, SPOOFER_TAG); return status; }

    PVOID  tableBase = info->Buffer;
    ULONG  tableLen  = info->BufferLen;
    PUCHAR tableEnd  = (PUCHAR)tableBase + tableLen;

    PSMBIOS_TYPE1 t1 = (PSMBIOS_TYPE1)Smbios_FindType(tableBase, tableLen, 1);
    if (t1) {
        Gen_Guid(t1->UUID);
        if (t1->SerialNumber) {
            CHAR fs[SERIAL_LEN + 1];
            Gen_Serial(fs, SERIAL_LEN);
            Smbios_PatchString(&t1->Header, tableEnd, t1->SerialNumber, fs);
        }
    }

    PSMBIOS_TYPE2 t2 = (PSMBIOS_TYPE2)Smbios_FindType(tableBase, tableLen, 2);
    if (t2 && t2->SerialNumber) {
        CHAR fs[SERIAL_LEN + 1];
        Gen_Serial(fs, SERIAL_LEN);
        Smbios_PatchString(&t2->Header, tableEnd, t2->SerialNumber, fs);
    }

    PHYSICAL_ADDRESS lo = {0};
    lo.QuadPart = 0xF0000;
    PVOID scan = MmMapIoSpace(lo, 0x10000, MmNonCached);
    if (!scan) { ExFreePoolWithTag(info, SPOOFER_TAG); return STATUS_UNSUCCESSFUL; }

    PHYSICAL_ADDRESS physTable = {0};
    BOOLEAN found = FALSE;
    for (ULONG off = 0; off + sizeof(SMBIOS_ENTRY) <= 0x10000; off += 16) {
        PUCHAR p = (PUCHAR)scan + off;
        if (p[0]=='_'&&p[1]=='S'&&p[2]=='M'&&p[3]=='_') {
            physTable.QuadPart = ((PSMBIOS_ENTRY)p)->StructTableAddr;
            found = TRUE; break;
        }
        if (p[0]=='_'&&p[1]=='S'&&p[2]=='M'&&p[3]=='3'&&p[4]=='_') {
            physTable.QuadPart = (LONGLONG)((SMBIOS3_ENTRY*)p)->StructTableAddr;
            found = TRUE; break;
        }
    }
    MmUnmapIoSpace(scan, 0x10000);

    if (found && physTable.QuadPart) {
        PVOID mapped = MmMapIoSpace(physTable, tableLen, MmNonCached);
        if (mapped) { RtlCopyMemory(mapped, tableBase, tableLen); MmUnmapIoSpace(mapped, tableLen); }
    }

    ExFreePoolWithTag(info, SPOOFER_TAG);
    return STATUS_SUCCESS;
}
