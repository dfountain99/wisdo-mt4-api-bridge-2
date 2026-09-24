#include "WisdoPlayerCharacter.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/InputComponent.h"
#include "Components/StaticMeshComponent.h"

AWisdoPlayerCharacter::AWisdoPlayerCharacter()
{
    CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
    CameraBoom->SetupAttachment(RootComponent);
    CameraBoom->TargetArmLength = 450.f;
    CameraBoom->bUsePawnControlRotation = true;
    FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
    FollowCamera->SetupAttachment(CameraBoom);
    FollowCamera->bUsePawnControlRotation = false;
    Body = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Body"));
    Body->SetupAttachment(RootComponent);
    Body->SetStaticMesh(LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cylinder.Cylinder")));
    Body->SetRelativeScale3D(FVector(0.4,0.4,1.6));
    Body->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    bUseControllerRotationYaw = false;
    GetCharacterMovement()->bOrientRotationToMovement = true;
    GetCharacterMovement()->RotationRate = FRotator(0, 540, 0);
}

void AWisdoPlayerCharacter::SetupPlayerInputComponent(UInputComponent* Input)
{
    Super::SetupPlayerInputComponent(Input);
    Input->BindAxis(TEXT("MoveForward"), this, &AWisdoPlayerCharacter::MoveForward);
    Input->BindAxis(TEXT("MoveRight"), this, &AWisdoPlayerCharacter::MoveRight);
    Input->BindAxis(TEXT("Turn"), this, &APawn::AddControllerYawInput);
    Input->BindAxis(TEXT("LookUp"), this, &APawn::AddControllerPitchInput);
    Input->BindAction(TEXT("Jump"), IE_Pressed, this, &ACharacter::Jump);
    Input->BindAction(TEXT("Jump"), IE_Released, this, &ACharacter::StopJumping);
}

void AWisdoPlayerCharacter::MoveForward(float Value)
{
    if (Controller && !FMath::IsNearlyZero(Value))
        AddMovementInput(FRotationMatrix(FRotator(0, Controller->GetControlRotation().Yaw, 0)).GetUnitAxis(EAxis::X), Value);
}
void AWisdoPlayerCharacter::MoveRight(float Value)
{
    if (Controller && !FMath::IsNearlyZero(Value))
        AddMovementInput(FRotationMatrix(FRotator(0, Controller->GetControlRotation().Yaw, 0)).GetUnitAxis(EAxis::Y), Value);
}
