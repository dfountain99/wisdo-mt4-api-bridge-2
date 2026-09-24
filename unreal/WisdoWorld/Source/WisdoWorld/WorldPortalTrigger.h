#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "WorldPortalTrigger.generated.h"

class UBoxComponent;
class UPrimitiveComponent;

UCLASS()
class WISDOWORLD_API AWorldPortalTrigger : public AActor
{
    GENERATED_BODY()
public:
    AWorldPortalTrigger();
protected:
    virtual void BeginPlay() override;
private:
    UPROPERTY(VisibleAnywhere) UBoxComponent* Trigger;
    UFUNCTION() void OnEnter(UPrimitiveComponent* Overlapped, AActor* Other,
        UPrimitiveComponent* OtherComponent, int32 BodyIndex, bool FromSweep, const FHitResult& Sweep);
};
