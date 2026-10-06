#pragma once
#include <ntddk.h>
#include <wdm.h>
#include <ntddscsi.h>
#include <ntddstor.h>

#define SPOOFER_TAG     'frpS'
#define MAX_DISKS       16
#define SERIAL_LEN      20
#define MAC_LEN         6

// ---- RNG state ----
typedef struct _SPOOF_RNG {
    ULONGLONG state[4];
} SPOOF_RNG;

// ---- Disk hook entry ----
typedef struct _DISK_HOOK {
    PDRIVER_OBJECT  DriverObj;
    PDRIVER_DISPATCH OrigDispatch;
    CHAR            FakeSerial[SERIAL_LEN + 1];
    BOOLEAN         Active;
} DISK_HOOK, *PDISK_HOOK;

// ---- NIC hook entry ----
typedef struct _NIC_HOOK {
    PDRIVER_OBJECT  DriverObj;
    PVOID           OrigMiniportOidRequest; // NDIS_MINIPORT_OID_REQUEST
    UCHAR           FakeMac[MAC_LEN];
    BOOLEAN         Active;
} NIC_HOOK, *PNIC_HOOK;

// ---- SMBIOS structures ----
#pragma pack(push, 1)
typedef struct _SMBIOS_ENTRY {
    CHAR    Anchor[4];      // "_SM_"
    UCHAR   Checksum;
    UCHAR   Length;
    UCHAR   MajorVersion;
    UCHAR   MinorVersion;
    USHORT  MaxStructSize;
    UCHAR   Revision;
    UCHAR   FormattedArea[5];
    CHAR    IntermAnchor[5]; // "_DMI_"
    UCHAR   IntermChecksum;
    USHORT  StructTableLen;
    ULONG   StructTableAddr;
    USHORT  NumStructs;
    UCHAR   BCDRevision;
} SMBIOS_ENTRY, *PSMBIOS_ENTRY;

typedef struct _SMBIOS_HEADER {
    UCHAR   Type;
    UCHAR   Length;
    USHORT  Handle;
} SMBIOS_HEADER, *PSMBIOS_HEADER;

// Type 1 - System Info
typedef struct _SMBIOS_TYPE1 {
    SMBIOS_HEADER Header;
    UCHAR   Manufacturer;
    UCHAR   ProductName;
    UCHAR   Version;
    UCHAR   SerialNumber;
    UCHAR   UUID[16];
    UCHAR   WakeUpType;
    UCHAR   SKUNumber;
    UCHAR   Family;
} SMBIOS_TYPE1, *PSMBIOS_TYPE1;

// Type 2 - Baseboard
typedef struct _SMBIOS_TYPE2 {
    SMBIOS_HEADER Header;
    UCHAR   Manufacturer;
    UCHAR   Product;
    UCHAR   Version;
    UCHAR   SerialNumber;
    UCHAR   AssetTag;
    UCHAR   FeatureFlags;
    UCHAR   LocationInChassis;
    USHORT  ChassisHandle;
    UCHAR   BoardType;
    UCHAR   NumContainedHandles;
} SMBIOS_TYPE2, *PSMBIOS_TYPE2;
#pragma pack(pop)

// ---- Globals ----
extern DISK_HOOK    g_DiskHooks[MAX_DISKS];
extern ULONG        g_DiskHookCount;
extern SPOOF_RNG    g_Rng;

// ---- Module exports ----
NTSTATUS Disk_Init(void);
void     Disk_Cleanup(void);

NTSTATUS Smbios_Patch(void);

NTSTATUS Registry_Spoof(void);

NTSTATUS Nic_Init(void);
void     Nic_Cleanup(void);

NTSTATUS Vol_Init(void);
void     Vol_Cleanup(void);

// ---- Utils ----
void     Rng_Init(PSPOOF_RNG rng);
ULONGLONG Rng_Next(PSPOOF_RNG rng);
void     Gen_Serial(PCHAR out, ULONG len);
void     Gen_Mac(PUCHAR mac);
void     Gen_Guid(PUCHAR guid16);
void     Gen_GuidStr(PWCHAR out, ULONG maxChars);
