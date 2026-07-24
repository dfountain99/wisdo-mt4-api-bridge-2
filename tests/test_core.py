import tempfile
import unittest
from wisdo_core.recognition import milestone_message, recognize
from wisdo_core.store import Store

class CoreTests(unittest.TestCase):
    def test_recognition(self):
        result = recognize("derrion", "Derrion")
        self.assertIn("Derrion", result.message)

    def test_growth_milestones_are_not_repeated(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Store(f"{directory}/test.db")
            self.assertEqual(store.evaluate_growth("A", 100), [])
            self.assertEqual(store.evaluate_growth("A", 149), [])
            self.assertEqual(store.evaluate_growth("A", 151), [50])
            self.assertEqual(store.evaluate_growth("A", 210), [100])
            self.assertEqual(store.evaluate_growth("A", 210), [])

    def test_milestone_message(self):
        self.assertIn("100%", milestone_message("Derrion", 100))

if __name__ == "__main__":
    unittest.main()
