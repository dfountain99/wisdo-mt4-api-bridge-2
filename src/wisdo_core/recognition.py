from __future__ import annotations
from dataclasses import dataclass, asdict

@dataclass
class Recognition:
    user_id: str
    display_name: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)

def recognize(user_id: str, display_name: str) -> Recognition:
    name = display_name.strip() or "Member"
    return Recognition(user_id=user_id, display_name=name, message=f"Welcome back, {name}. Wisdo Core is online and ready.")

def milestone_message(display_name: str, percent: int) -> str:
    variants = {
        50: "Momentum confirmed",
        100: "Account doubled",
        150: "Expansion level reached",
        200: "Capital multiplied again",
    }
    title = variants.get(percent, "New growth level unlocked")
    return f"{display_name}, {title}. Your account has reached {percent}% growth from its Wisdo baseline."
