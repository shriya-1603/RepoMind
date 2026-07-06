class PromptBuilder:
    """Specialized prompt templates for each repository intelligence generator node."""

    @staticmethod
    def build_purpose_prompt(facts: dict) -> str:
        return f"""
You are writing the "What is this project?" section.
Repository facts:
{facts}
Requirements: Explain what problem it solves, general overview, and architecture organization.
"""

    @staticmethod
    def build_reading_guide_prompt(facts: dict) -> str:
        return f"""
You are generating the onboarding guide.
Repository facts:
{facts}
"""

    @staticmethod
    def build_health_prompt(facts: dict) -> str:
        return f"""
You are writing the senior engineer health analysis.
Repository facts:
{facts}
"""
