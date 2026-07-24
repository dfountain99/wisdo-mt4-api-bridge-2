from .config import Settings
from .server import run

def main() -> None:
    run(Settings())

if __name__ == "__main__":
    main()
