using UnrealBuildTool;
using System.Collections.Generic;

public class WisdoWorldEditorTarget : TargetRules
{
    public WisdoWorldEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        ExtraModuleNames.Add("WisdoWorld");
    }
}
