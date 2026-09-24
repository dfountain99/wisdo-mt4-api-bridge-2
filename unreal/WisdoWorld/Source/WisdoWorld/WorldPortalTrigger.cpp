#include "WorldPortalTrigger.h"
#include "Components/BoxComponent.h"
#include "GameFramework/Character.h"
#include "Engine/Engine.h"

AWorldPortalTrigger::AWorldPortalTrigger()
{
    Trigger = CreateDefaultSubobject<UBoxComponent>(TEXT("PortalTrigger"));
    RootComponent = Trigger;
    Trigger->SetBoxExtent(FVector(100,110,180));
    Trigger->SetCollisionProfileName(TEXT("Trigger"));
    Trigger->SetGenerateOverlapEvents(true);
}

void AWorldPortalTrigger::BeginPlay()
{
    Super::BeginPlay();
    Trigger->OnComponentBeginOverlap.AddDynamic(this, &AWorldPortalTrigger::OnEnter);
}

void AWorldPortalTrigger::OnEnter(UPrimitiveComponent*, AActor* Other,
    UPrimitiveComponent*, int32, bool, const FHitResult&)
{
    if (!Other || !Other->IsA<ACharacter>()) return;
    UE_LOG(LogTemp, Display, TEXT("WISDO World: player entered inactive portal %s"), *GetName());
    if (GEngine) GEngine->AddOnScreenDebugMessage(-1, 4.f, FColor::Cyan,
        TEXT("PORTAL REACHED - destination not connected"));
}
