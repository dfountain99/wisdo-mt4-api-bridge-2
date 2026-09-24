#pragma once

#include "CoreMinimal.h"
#include "Dom/JsonObject.h"

struct FWisdoOperation
{
    FString Id;
    FString Type;
    TSharedPtr<FJsonObject> Payload;
};

struct FWisdoValidationView
{
    FString Id;
    FVector Position;
    FVector Target;
};

struct FWisdoManifest
{
    FString WorldId;
    FString Name;
    int32 Revision = 0;
    FVector Spawn = FVector(0, 600, 100);
    TArray<FWisdoOperation> Operations;
    TArray<FWisdoValidationView> ValidationViews;
};

class FWisdoManifestClient
{
public:
    // Local proof loads an exported WISDO manifest. Remote sessions come later.
    static bool LoadFile(const FString& Filename, FWisdoManifest& Out, FString& Error);
};
