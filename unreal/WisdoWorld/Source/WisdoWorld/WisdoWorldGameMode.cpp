#include "WisdoWorldGameMode.h"
#include "WisdoPlayerCharacter.h"
#include "WorldRuntimeActor.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"

AWisdoWorldGameMode::AWisdoWorldGameMode()
{
    DefaultPawnClass = AWisdoPlayerCharacter::StaticClass();
}

void AWisdoWorldGameMode::BeginPlay()
{
    Super::BeginPlay();
    FString Filename;
    if (!FParse::Value(FCommandLine::Get(), TEXT("WisdoManifest="), Filename))
        Filename = FPaths::ProjectContentDir() / TEXT("WISDO/Fixtures/mountain_kingdom.json");
    AWorldRuntimeActor* Builder = GetWorld()->SpawnActor<AWorldRuntimeActor>();
    FVector Spawn;
    if (!Builder || !Builder->BuildFromFile(Filename, Spawn)) return;
    APlayerController* Player = UGameplayStatics::GetPlayerController(this, 0);
    if (Player)
    {
        if (!Player->GetPawn())
            if (APawn* NewPawn = SpawnDefaultPawnAtTransform(Player, FTransform(Spawn))) Player->Possess(NewPawn);
        if (APawn* Pawn = Player->GetPawn()) Pawn->SetActorLocation(Spawn, false, nullptr, ETeleportType::TeleportPhysics);
    }
}
