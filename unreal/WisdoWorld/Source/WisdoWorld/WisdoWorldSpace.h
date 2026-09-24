#pragma once
#include "CoreMinimal.h"

// WISDO manifest v1: x east, y height, z south, one unit = one meter.
// UE axes: X east, Y south, Z height; one unit = one centimeter.
struct FWisdoWorldSpace
{
    static FVector ToUnreal(double X, double Y, double Z) { return FVector(X * 100.0, Z * 100.0, Y * 100.0); }
    static FVector ToUnrealScale(double Width, double Height, double Depth) { return FVector(Width, Depth, Height); }
    static FVector FromUnreal(const FVector& P) { return FVector(P.X / 100.0, P.Z / 100.0, P.Y / 100.0); }
};
