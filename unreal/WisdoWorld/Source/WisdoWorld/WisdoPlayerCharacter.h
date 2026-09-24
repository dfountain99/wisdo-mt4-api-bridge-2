#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "WisdoPlayerCharacter.generated.h"

class USpringArmComponent;
class UCameraComponent;
class UStaticMeshComponent;

UCLASS()
class WISDOWORLD_API AWisdoPlayerCharacter : public ACharacter
{
    GENERATED_BODY()
public:
    AWisdoPlayerCharacter();
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
private:
    UPROPERTY(VisibleAnywhere) USpringArmComponent* CameraBoom;
    UPROPERTY(VisibleAnywhere) UCameraComponent* FollowCamera;
    UPROPERTY(VisibleAnywhere) UStaticMeshComponent* Body;
    void MoveForward(float Value);
    void MoveRight(float Value);
};
