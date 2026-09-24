#include "WorldManifestTypes.h"
#include "Dom/JsonValue.h"
#include "Misc/FileHelper.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

bool FWisdoManifestClient::LoadFile(const FString& Filename, FWisdoManifest& Out, FString& Error)
{
    FString Contents;
    if (!FFileHelper::LoadFileToString(Contents, *Filename))
    {
        Error = FString::Printf(TEXT("Manifest file missing: %s"), *Filename);
        return false;
    }
    TSharedPtr<FJsonObject> Root;
    const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Contents);
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
    {
        Error = TEXT("Manifest is not valid JSON");
        return false;
    }
    // The authenticated API wraps the actual manifest in {ok,manifest}.
    const TSharedPtr<FJsonObject>* Wrapped = nullptr;
    if (Root->TryGetObjectField(TEXT("manifest"), Wrapped)) Root = *Wrapped;
    FString Schema;
    if (!Root.IsValid() || !Root->TryGetStringField(TEXT("schema"), Schema) || Schema != TEXT("wisdo-unreal-world-v1") ||
        !Root->TryGetStringField(TEXT("worldId"), Out.WorldId) || Out.WorldId.IsEmpty())
    {
        Error = TEXT("Expected wisdo-unreal-world-v1 and a worldId");
        return false;
    }
    Root->TryGetStringField(TEXT("name"), Out.Name);
    double Revision = 0;
    Root->TryGetNumberField(TEXT("revision"), Revision);
    Out.Revision = static_cast<int32>(Revision);
    const TSharedPtr<FJsonObject>* Spawn = nullptr;
    if (Root->TryGetObjectField(TEXT("spawn"), Spawn))
    {
        double X=0, Y=1, Z=6;
        (*Spawn)->TryGetNumberField(TEXT("x"), X);
        (*Spawn)->TryGetNumberField(TEXT("y"), Y);
        (*Spawn)->TryGetNumberField(TEXT("z"), Z);
        Out.Spawn = FVector(X * 100, Z * 100, Y * 100);
    }
    const TArray<TSharedPtr<FJsonValue>>* Operations = nullptr;
    if (Root->TryGetArrayField(TEXT("operations"), Operations))
    {
        if (Operations->Num() > 256) { Error = TEXT("Too many world operations"); return false; }
        for (const TSharedPtr<FJsonValue>& Value : *Operations)
        {
            const TSharedPtr<FJsonObject> Item = Value->AsObject();
            if (!Item.IsValid()) continue;
            FWisdoOperation Operation;
            if (!Item->TryGetStringField(TEXT("type"), Operation.Type)) continue;
            const TSharedPtr<FJsonObject>* Payload = nullptr;
            if (Item->TryGetObjectField(TEXT("payload"), Payload)) Operation.Payload = *Payload;
            Out.Operations.Add(MoveTemp(Operation));
        }
    }
    return true;
}
