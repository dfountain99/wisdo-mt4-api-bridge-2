using UnrealBuildTool;

public class WisdoWorld : ModuleRules
{
    public WisdoWorld(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "InputCore", "Json", "JsonUtilities" });
    }
}
