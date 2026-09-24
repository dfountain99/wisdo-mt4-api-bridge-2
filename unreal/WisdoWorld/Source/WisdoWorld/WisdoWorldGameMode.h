#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "WisdoWorldGameMode.generated.h"

UCLASS()
class WISDOWORLD_API AWisdoWorldGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    AWisdoWorldGameMode();
    virtual void BeginPlay() override;
};
