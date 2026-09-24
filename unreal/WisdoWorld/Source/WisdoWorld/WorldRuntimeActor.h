#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "WorldManifestTypes.h"
#include "WorldRuntimeActor.generated.h"

class AStaticMeshActor;

UCLASS()
class WISDOWORLD_API AWorldRuntimeActor : public AActor
{
    GENERATED_BODY()
public:
    AWorldRuntimeActor();
    bool BuildFromFile(const FString& Filename, FVector& PlayerSpawn);
private:
    using FOperationHandler = TFunction<void(const TSharedPtr<FJsonObject>&)>;
    TMap<FString, FOperationHandler> Registry;
    FString CurrentOperationId;
    int32 SpawnedCount = 0;
    int32 SpawnFailures = 0;
    void RegisterOperations();
    FVector Position(const TSharedPtr<FJsonObject>& Data, FVector Default) const;
    float Yaw(const TSharedPtr<FJsonObject>& Data) const;
    AStaticMeshActor* Shape(const TCHAR* MeshPath, FVector Location, FVector Scale, FLinearColor Color, bool Collides = true);
    void Terrain(const TSharedPtr<FJsonObject>& Data);
    void Mountains(const TSharedPtr<FJsonObject>& Data);
    void Water(const TSharedPtr<FJsonObject>& Data);
    void Forest(const TSharedPtr<FJsonObject>& Data);
    void Building(const TSharedPtr<FJsonObject>& Data, FString Kind);
    void Portal(const TSharedPtr<FJsonObject>& Data);
    void Atmosphere();
};
