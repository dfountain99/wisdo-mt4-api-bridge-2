#include "WorldRuntimeActor.h"
#include "Engine/StaticMeshActor.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/DirectionalLight.h"
#include "Engine/SkyLight.h"
#include "Engine/ExponentialHeightFog.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Engine/Engine.h"
#include "Misc/CommandLine.h"

// Manifest distances are meters. Unreal units are centimeters. Manifest z is
// horizontal depth; manifest y is height.
AWorldRuntimeActor::AWorldRuntimeActor() { PrimaryActorTick.bCanEverTick = false; }

FVector AWorldRuntimeActor::Position(const TSharedPtr<FJsonObject>& Data, FVector Default) const
{
    const TSharedPtr<FJsonObject>* Pos = nullptr;
    if (!Data.IsValid() || !Data->TryGetObjectField(TEXT("position"), Pos)) return Default;
    double X=Default.X/100, Y=Default.Z/100, Z=Default.Y/100;
    (*Pos)->TryGetNumberField(TEXT("x"), X);
    (*Pos)->TryGetNumberField(TEXT("y"), Y);
    (*Pos)->TryGetNumberField(TEXT("z"), Z);
    return FVector(X*100, Z*100, Y*100);
}

AStaticMeshActor* AWorldRuntimeActor::Shape(const TCHAR* MeshPath, FVector Location, FVector Scale, FLinearColor Color, bool Collides)
{
    UStaticMesh* Mesh = LoadObject<UStaticMesh>(nullptr, MeshPath);
    if (!Mesh) { UE_LOG(LogTemp, Error, TEXT("WISDO missing mesh %s"), MeshPath); return nullptr; }
    AStaticMeshActor* Actor = GetWorld()->SpawnActor<AStaticMeshActor>(Location, FRotator::ZeroRotator);
    if (!Actor) return nullptr;
    UStaticMeshComponent* Component = Actor->GetStaticMeshComponent();
    Component->SetMobility(EComponentMobility::Movable);
    Component->SetStaticMesh(Mesh);
    Component->SetCollisionEnabled(Collides ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
    Actor->SetActorScale3D(Scale);
    // A curated visual catalog can replace these stock meshes and materials.
    if (UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial")))
    {
        UMaterialInstanceDynamic* Material = UMaterialInstanceDynamic::Create(Base, Actor);
        Material->SetVectorParameterValue(TEXT("Color"), Color);
        Component->SetMaterial(0, Material);
    }
    return Actor;
}

void AWorldRuntimeActor::Terrain(const TSharedPtr<FJsonObject>&)
{
    Shape(TEXT("/Engine/BasicShapes/Cube.Cube"), FVector(0,0,-75), FVector(60,60,1.5), FLinearColor(0.12,0.3,0.17));
}
void AWorldRuntimeActor::Mountains(const TSharedPtr<FJsonObject>& Data)
{
    double Height=2.8;
    if (Data.IsValid()) Data->TryGetNumberField(TEXT("height"), Height);
    Height = FMath::Clamp(Height, 2.0, 20.0);
    for (int32 I=0; I<7; ++I)
    {
        const float H = float(Height * 100 * (0.7 + (I%3)*0.25));
        Shape(TEXT("/Engine/BasicShapes/Cone.Cone"), FVector(-1900+I*580,-1600+(I%2)*380,H/2),
              FVector(8,8,H/100), FLinearColor(0.28,0.32,0.36));
    }
}
void AWorldRuntimeActor::Water(const TSharedPtr<FJsonObject>&)
{
    Shape(TEXT("/Engine/BasicShapes/Cube.Cube"), FVector(0,0,-170), FVector(400,400,0.15), FLinearColor(0.025,0.18,0.46), false);
}
void AWorldRuntimeActor::Forest(const TSharedPtr<FJsonObject>&)
{
    for (int32 I=0; I<20; ++I)
    {
        const FVector P(-2400+(I%5)*230, 650+(I/5)*260, 150);
        Shape(TEXT("/Engine/BasicShapes/Cone.Cone"), P, FVector(1,1,3), FLinearColor(0.03,0.24,0.08));
    }
}
void AWorldRuntimeActor::Building(const TSharedPtr<FJsonObject>& Data, FString Kind)
{
    const FVector P = Position(Data, FVector(0,-800,0));
    const bool Tall = Kind==TEXT("tower") || Kind==TEXT("castle") || Kind==TEXT("city");
    double Height = Tall ? 14 : 4;
    if (Data.IsValid()) Data->TryGetNumberField(TEXT("height"), Height);
    Height = FMath::Clamp(Height, 2.0, 50.0);
    Shape(TEXT("/Engine/BasicShapes/Cube.Cube"), P+FVector(0,0,Height*50),
          FVector(Tall?7:6,Tall?7:6,Height),
          Kind==TEXT("tower") ? FLinearColor(0.08,0.45,0.8) : FLinearColor(0.5,0.43,0.3));
}
void AWorldRuntimeActor::Portal(const TSharedPtr<FJsonObject>& Data)
{
    const FVector P = Position(Data, FVector(900,-800,0));
    Shape(TEXT("/Engine/BasicShapes/Cube.Cube"), P+FVector(0,-130,200), FVector(0.5,0.35,4), FLinearColor(0.15,0.65,1), false);
    Shape(TEXT("/Engine/BasicShapes/Cube.Cube"), P+FVector(0,130,200), FVector(0.5,0.35,4), FLinearColor(0.15,0.65,1), false);
    Shape(TEXT("/Engine/BasicShapes/Cube.Cube"), P+FVector(0,0,400), FVector(0.5,2.9,0.4), FLinearColor(0.15,0.65,1), false);
}
void AWorldRuntimeActor::Atmosphere()
{
    ADirectionalLight* Sun = GetWorld()->SpawnActor<ADirectionalLight>(FVector::ZeroVector, FRotator(-45,-35,0));
    if (Sun) Sun->GetLightComponent()->SetIntensity(5.f);
    ASkyLight* Sky = GetWorld()->SpawnActor<ASkyLight>();
    if (Sky) { Sky->GetLightComponent()->SetMobility(EComponentMobility::Movable); Sky->GetLightComponent()->SetIntensity(1.5f); }
    AExponentialHeightFog* Fog = GetWorld()->SpawnActor<AExponentialHeightFog>();
    if (Fog) Fog->GetComponent()->SetFogDensity(0.003f);
}

void AWorldRuntimeActor::RegisterOperations()
{
    Registry.Add(TEXT("CREATE_LANDMASS"), [this](const auto& P){ Terrain(P); });
    Registry.Add(TEXT("CREATE_MOUNTAIN_RANGE"), [this](const auto& P){ Mountains(P); });
    Registry.Add(TEXT("CREATE_OCEAN"), [this](const auto& P){ Water(P); });
    Registry.Add(TEXT("CREATE_RIVER"), [this](const auto& P){ Water(P); });
    Registry.Add(TEXT("CREATE_FOREST"), [this](const auto& P){ Forest(P); });
    Registry.Add(TEXT("CREATE_CASTLE"), [this](const auto& P){ Building(P,TEXT("castle")); });
    Registry.Add(TEXT("CREATE_CITY_ZONE"), [this](const auto& P){ Building(P,TEXT("city")); });
    Registry.Add(TEXT("CREATE_TOWER"), [this](const auto& P){ Building(P,TEXT("tower")); });
    Registry.Add(TEXT("CREATE_HOME"), [this](const auto& P){ Building(P,TEXT("home")); });
    Registry.Add(TEXT("CREATE_CRAFTING_LAB"), [this](const auto& P){ Building(P,TEXT("craft")); });
    Registry.Add(TEXT("CREATE_PORTAL"), [this](const auto& P){ Portal(P); });
    Registry.Add(TEXT("SET_THEME"), [](const auto&){});
    Registry.Add(TEXT("CREATE_SPACE_BODY"), [this](const auto& P){ Shape(TEXT("/Engine/BasicShapes/Sphere.Sphere"), Position(P,FVector(800,-700,650)), FVector(1), FLinearColor::White, false); });
    Registry.Add(TEXT("PREVIEW_MODULE"), [](const auto&){});
}

bool AWorldRuntimeActor::BuildFromFile(const FString& Filename, FVector& PlayerSpawn)
{
    FWisdoManifest Manifest;
    FString Error;
    if (!FWisdoManifestClient::LoadFile(Filename, Manifest, Error))
    {
        UE_LOG(LogTemp, Error, TEXT("WISDO World: %s"), *Error);
        if (GEngine) GEngine->AddOnScreenDebugMessage(-1, 20, FColor::Red, Error);
        return false;
    }
    PlayerSpawn = Manifest.Spawn;
    RegisterOperations();
    Terrain(nullptr);
    Atmosphere();
    for (const FWisdoOperation& Operation : Manifest.Operations)
    {
        if (FOperationHandler* Handler = Registry.Find(Operation.Type)) (*Handler)(Operation.Payload);
        else UE_LOG(LogTemp, Warning, TEXT("WISDO World: unsupported operation %s"), *Operation.Type);
    }
    UE_LOG(LogTemp, Display, TEXT("WISDO World built %s revision %d with %d operations"), *Manifest.WorldId, Manifest.Revision, Manifest.Operations.Num());
    return true;
}
