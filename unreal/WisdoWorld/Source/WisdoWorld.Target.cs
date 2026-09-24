using UnrealBuildTool;
using System.Collections.Generic;

public class WisdoWorldTarget : TargetRules
{
    public WisdoWorldTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        ExtraModuleNames.Add("WisdoWorld");
    }
}
