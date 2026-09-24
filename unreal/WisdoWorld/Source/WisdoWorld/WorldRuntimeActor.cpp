#include "WorldRuntimeActor.h"
#include "WisdoWorldSpace.h"
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
#include "Engine/World.h"
#include "DrawDebugHelpers.h"
#include "WorldPortalTrigger.h"

static double Dimension(const TSharedPtr<FJsonObject>& Data, const TCHAR* Axis, double Fallback)
{
    const TSharedPtr<FJsonObject>* Dimensions = nullptr;
    double Value = Fallback;
    if (Data.IsValid() && Data->TryGetObjectField(TEXT("dimensions"), Dimensions)) (*Dimensions)->TryGetNumberField(Axis, Value);
    return FMath::Clamp(Value, 0.1, 3000.0);
}

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
    return FWisdoWorldSpace::ToUnreal(X, Y, Z);
}

float AWorldRuntimeActor::Yaw(const TSharedPtr<FJsonObject>& Data) const
{
    const TSharedPtr<FJsonObject>* Rotation = nullptr;
    double Degrees = 0;
    if (Data.IsValid() && Data->TryGetObjectField(TEXT("rotation"), Rotation))
        (*Rotation)->TryGetNumberField(TEXT("y"), Degrees);
    return FMath::Clamp(static_cast<float>(Degrees), -360.f, 360.f);
}

AStaticMeshActor* AWorldRuntimeActor::Shape(const TCHAR* MeshPath, FVector Location, FVector Scale, FLinearColor Color, bool Collides)
{
    UStaticMesh* Mesh = LoadObject<UStaticMesh>(nullptr, MeshPath);
    if (!Mesh) { ++SpawnFailures; UE_LOG(LogTemp, Error, TEXT("WISDO %s missing mesh %s"), *CurrentOperationId, MeshPath); return nullptr; }
    AStaticMeshActor* Actor = GetWorld()->SpawnActor<AStaticMeshActor>(Location, FRotator::ZeroRotator);
    if (!Actor) { ++SpawnFailures; return nullptr; }
    ++SpawnedCount;
    Actor->Tags.Add(FName(*CurrentOperationId));
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

void AWorldRuntimeActor::Terrain(const TSharedPtr<FJsonObject>& Data)
{
    const FVector P = Position(Data, FVector::ZeroVector);
    Shape(TEXT("/Engine/BasicShapes/Cube.Cube"), P+FVector(0,0,-75), FVector(Dimension(Data,TEXT("x"),60),Dimension(Data,TEXT("z"),60),1.5), FLinearColor(0.12,0.3,0.17));
}
void AWorldRuntimeActor::Mountains(const TSharedPtr<FJsonObject>& Data)
{
    double Height=2.8, Radius=6;
    if (Data.IsValid()) { Data->TryGetNumberField(TEXT("height"), Height); Data->TryGetNumberField(TEXT("radius"), Radius); }
    Height = FMath::Clamp(Height, 2.0, 20.0);
    Radius = FMath::Clamp(Radius, 2.0, 20.0);
    const FVector P = Position(Data, FVector(-1200,-1600,0));
    const double Width=Dimension(Data,TEXT("x"),18), Depth=Dimension(Data,TEXT("z"),6);
    Height=Dimension(Data,TEXT("y"),Height);
    for (int32 I=0; I<8; ++I)
    {
        const float H = float(Height * 100 * (0.65 + (I%3)*0.16));
        Shape(TEXT("/Engine/BasicShapes/Cone.Cone"), P+FVector((I-3.5)*Width*100/8,((I%2)-0.5)*Depth*50,H/2),
              FVector(FMath::Min(Width/6,130.0),FMath::Min(Width/6,130.0),H/100), FLinearColor(0.28,0.32,0.36));
    }
}
void AWorldRuntimeActor::Water(const TSharedPtr<FJsonObject>& Data)
{
    double Radius=15;
    if (Data.IsValid()) Data->TryGetNumberField(TEXT("radius"), Radius);
    const float Width = 60.f + 2.f*FMath::Clamp(static_cast<float>(Radius), 9.f, 100.f);
    const FVector P = Position(Data, FVector(0,0,-170));
    Shape(TEXT("/Engine/BasicShapes/Cube.Cube"), P, FVector(Dimension(Data,TEXT("x"),Width),Dimension(Data,TEXT("z"),Width),0.15), FLinearColor(0.025,0.18,0.46), false);
}
void AWorldRuntimeActor::Road(const TSharedPtr<FJsonObject>& Data)
{
    const FVector P = Position(Data, FVector(0,0,4));
    AStaticMeshActor* Actor=Shape(TEXT("/Engine/BasicShapes/Cube.Cube"), P,
        FVector(Dimension(Data,TEXT("x"),10),Dimension(Data,TEXT("z"),100),Dimension(Data,TEXT("y"),0.08)),
        FLinearColor(0.28,0.32,0.35), false);
    if (Actor) Actor->SetActorRotation(FRotator(0,Yaw(Data),0));
}
void AWorldRuntimeActor::Forest(const TSharedPtr<FJsonObject>& Data)
{
    double Density=20, Radius=5;
    if (Data.IsValid()) { Data->TryGetNumberField(TEXT("density"), Density); Data->TryGetNumberField(TEXT("radius"), Radius); }
    const int32 Count=FMath::Clamp(FMath::RoundToInt(Density),1,64);
    const int32 Columns=FMath::CeilToInt(FMath::Sqrt(static_cast<float>(Count)));
    Radius=FMath::Clamp(Radius,2.0,20.0);
    const FVector Center=Position(Data,FVector(-2000,1100,0));
    const double Width=Dimension(Data,TEXT("x"),Radius*2),Depth=Dimension(Data,TEXT("z"),Radius*2),TreeHeight=Dimension(Data,TEXT("y"),3);
    for (int32 I=0; I<Count; ++I)
    {
        const FVector P=Center+FVector((-Width/2+(I%Columns)*Width/FMath::Max(1,Columns-1))*100,(-Depth/2+(I/Columns)*Depth/FMath::Max(1,Columns-1))*100,TreeHeight*50);
        Shape(TEXT("/Engine/BasicShapes/Cone.Cone"), P, FVector(FMath::Max(1.0,Width/80),FMath::Max(1.0,Width/80),TreeHeight), FLinearColor(0.03,0.24,0.08));
    }
}
void AWorldRuntimeActor::Building(const TSharedPtr<FJsonObject>& Data, FString Kind)
{
    const FVector P = Position(Data, FVector(0,-800,0));
    const bool Tall = Kind==TEXT("tower") || Kind==TEXT("castle") || Kind==TEXT("city");
    double Height = Tall ? 14 : 4;
    if (Data.IsValid()) Data->TryGetNumberField(TEXT("height"), Height);
    Height = Dimension(Data,TEXT("y"),FMath::Clamp(Height, 2.0, 50.0));
    AStaticMeshActor* Actor = Shape(TEXT("/Engine/BasicShapes/Cube.Cube"), P+FVector(0,0,Height*50),
          FVector(Dimension(Data,TEXT("x"),Tall?7:6),Dimension(Data,TEXT("z"),Tall?7:6),Height),
          Kind==TEXT("tower") ? FLinearColor(0.08,0.45,0.8) : FLinearColor(0.5,0.43,0.3));
    if (Actor) Actor->SetActorRotation(FRotator(0,Yaw(Data),0));
}
void AWorldRuntimeActor::Portal(const TSharedPtr<FJsonObject>& Data)
{
    const FVector P = Position(Data, FVector(900,-800,0));
    const FRotator Rotation(0,Yaw(Data),0);
    const float H=Dimension(Data,TEXT("y"),4),W=Dimension(Data,TEXT("x"),2.9);
    const FVector Offsets[] = {FVector(-W*50,0,H*50),FVector(W*50,0,H*50),FVector(0,0,H*100)};
    const FVector Scales[] = {FVector(0.5,0.5,H),FVector(0.5,0.5,H),FVector(W+0.5,0.5,0.4)};
    for (int32 I=0; I<3; ++I)
    {
        AStaticMeshActor* Frame = Shape(TEXT("/Engine/BasicShapes/Cube.Cube"), P+Rotation.RotateVector(Offsets[I]), Scales[I], FLinearColor(0.15,0.65,1), false);
        if (Frame) Frame->SetActorRotation(Rotation);
    }
    AWorldPortalTrigger* Trigger = GetWorld()->SpawnActor<AWorldPortalTrigger>(P+FVector(0,0,H*50),Rotation);
    if (Trigger) { ++SpawnedCount; Trigger->Tags.Add(FName(*CurrentOperationId)); }
    else ++SpawnFailures;
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
    Registry.Add(TEXT("CREATE_ROAD"), [this](const auto& P){ Road(P); });
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
    CurrentOperationId = TEXT("terrain:base");
    Terrain(nullptr);
    Atmosphere();
    TSet<FString> SeenOperations;
    for (int32 I=0; I<Manifest.Operations.Num(); ++I)
    {
        const FWisdoOperation& Operation = Manifest.Operations[I];
        SeenOperations.Add(Operation.Type);
        CurrentOperationId = Operation.Id.IsEmpty() ? FString::Printf(TEXT("op:%02d:%s"), I, *Operation.Type) : Operation.Id;
        const int32 Before = SpawnedCount;
        if (FOperationHandler* Handler = Registry.Find(Operation.Type)) (*Handler)(Operation.Payload);
        else { ++SpawnFailures; UE_LOG(LogTemp, Error, TEXT("WISDO World: unsupported %s"), *CurrentOperationId); }
        const int32 Created = SpawnedCount-Before;
        int32 Expected = -1;
        if (Operation.Type == TEXT("CREATE_MOUNTAIN_RANGE")) Expected = 8;
        else if (Operation.Type == TEXT("CREATE_FOREST"))
        {
            double Density=20;
            if (Operation.Payload.IsValid()) Operation.Payload->TryGetNumberField(TEXT("density"), Density);
            Expected = FMath::Clamp(FMath::RoundToInt(Density),1,64);
        }
        else if (Operation.Type == TEXT("CREATE_PORTAL")) Expected = 4;
        else if (Operation.Type.StartsWith(TEXT("CREATE_"))) Expected = 1;
        else if (Operation.Type == TEXT("SET_THEME") || Operation.Type == TEXT("PREVIEW_MODULE")) Expected = 0;
        if (Expected >= 0 && Created != Expected)
        {
            ++SpawnFailures;
            UE_LOG(LogTemp, Error, TEXT("WISDO %s expected=%d actual=%d"), *CurrentOperationId, Expected, Created);
        }
        const FVector Marker = Position(Operation.Payload, FVector(I*250,0,0)) + FVector(0,0,260);
        DrawDebugString(GetWorld(), Marker, CurrentOperationId, nullptr, FColor::Cyan, 600.f, true);
        UE_LOG(LogTemp, Display, TEXT("WISDO %s spawned=%d marker=%s"), *CurrentOperationId, Created, *Marker.ToString());
    }
    if (Manifest.WorldId == TEXT("fixture:golden-world"))
    {
        const FString Required[] = {TEXT("CREATE_MOUNTAIN_RANGE"),TEXT("CREATE_OCEAN"),TEXT("CREATE_FOREST"),
            TEXT("CREATE_CASTLE"),TEXT("CREATE_TOWER"),TEXT("CREATE_HOME"),TEXT("CREATE_CRAFTING_LAB"),TEXT("CREATE_PORTAL")};
        for (const FString& Type : Required)
            if (!SeenOperations.Contains(Type)) { ++SpawnFailures; UE_LOG(LogTemp, Error, TEXT("WISDO golden fixture missing %s"), *Type); }
        if (PlayerSpawn.Z < 90.f || FMath::Abs(PlayerSpawn.X) > 2900.f || FMath::Abs(PlayerSpawn.Y) > 2900.f)
        { ++SpawnFailures; UE_LOG(LogTemp, Error, TEXT("WISDO golden spawn outside walkable terrain")); }
    }
    UE_LOG(LogTemp, Display, TEXT("WISDO World %s revision %d operations=%d actors=%d failures=%d spawn=%s"),
        *Manifest.WorldId, Manifest.Revision, Manifest.Operations.Num(), SpawnedCount, SpawnFailures, *PlayerSpawn.ToString());
    UE_LOG(LogTemp, Display, TEXT("WISDO_VALIDATION_%s"), SpawnFailures == 0 ? TEXT("PASS") : TEXT("FAIL"));
    return SpawnFailures == 0;
}
