#include "WorldManifestTypes.h"
#include "WisdoWorldSpace.h"
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
        Out.Spawn = FWisdoWorldSpace::ToUnreal(X, Y, Z);
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
            Item->TryGetStringField(TEXT("id"), Operation.Id);
            if (!Item->TryGetStringField(TEXT("type"), Operation.Type)) continue;
            const TSharedPtr<FJsonObject>* Payload = nullptr;
            if (Item->TryGetObjectField(TEXT("payload"), Payload)) Operation.Payload = *Payload;
            Out.Operations.Add(MoveTemp(Operation));
        }
    }
    const TArray<TSharedPtr<FJsonValue>>* Views = nullptr;
    if (Root->TryGetArrayField(TEXT("validationViews"), Views))
    {
        if (Views->Num() > 16) { Error = TEXT("Too many validation views"); return false; }
        for (const TSharedPtr<FJsonValue>& Value : *Views)
        {
            const TSharedPtr<FJsonObject> View = Value->AsObject();
            if (!View.IsValid()) continue;
            FWisdoValidationView Anchor;
            if (!View->TryGetStringField(TEXT("id"), Anchor.Id)) continue;
            const TSharedPtr<FJsonObject>* Position = nullptr;
            const TSharedPtr<FJsonObject>* Target = nullptr;
            if (!View->TryGetObjectField(TEXT("position"), Position) || !View->TryGetObjectField(TEXT("target"), Target)) continue;
            double PX=0,PY=0,PZ=0,TX=0,TY=0,TZ=0;
            if (!(*Position)->TryGetNumberField(TEXT("x"),PX) || !(*Position)->TryGetNumberField(TEXT("y"),PY) || !(*Position)->TryGetNumberField(TEXT("z"),PZ) ||
                !(*Target)->TryGetNumberField(TEXT("x"),TX) || !(*Target)->TryGetNumberField(TEXT("y"),TY) || !(*Target)->TryGetNumberField(TEXT("z"),TZ)) continue;
            Anchor.Position=FWisdoWorldSpace::ToUnreal(PX,PY,PZ);
            Anchor.Target=FWisdoWorldSpace::ToUnreal(TX,TY,TZ);
            Out.ValidationViews.Add(Anchor);
        }
    }
    return true;
}
