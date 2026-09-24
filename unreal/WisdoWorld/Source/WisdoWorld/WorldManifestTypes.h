#pragma once

#include "CoreMinimal.h"
#include "Dom/JsonObject.h"

struct FWisdoOperation
{
    FString Type;
    TSharedPtr<FJsonObject> Payload;
};

struct FWisdoManifest
{
    FString WorldId;
    FString Name;
    int32 Revision = 0;
    FVector Spawn = FVector(0, 600, 100);
    TArray<FWisdoOperation> Operations;
};

class FWisdoManifestClient
{
public:
    // Local proof loads an exported WISDO manifest. Remote sessions come later.
    static bool LoadFile(const FString& Filename, FWisdoManifest& Out, FString& Error);
};
