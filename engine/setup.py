from setuptools import setup, find_packages

setup(
    name="omnitrace-engine",
    version="1.0.0",
    description="OmniTrace AI — Static AST Extractor, Cross-Repo Linker & Passive Contract Drift Detection Engine",
    author="OmniTrace Engineering",
    packages=find_packages(),
    entry_points={
        "console_scripts": [
            "omnitrace=omnitrace.cli:main",
        ],
    },
    python_requires=">=3.8",
)
