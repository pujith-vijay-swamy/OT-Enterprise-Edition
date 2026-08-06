from setuptools import setup, find_packages

setup(
    name="repotrace-engine",
    version="1.0.0",
    description="RepoTrace AI — Static AST Extractor, Cross-Repo Linker & Passive Contract Drift Detection Engine",
    author="RepoTrace Engineering",
    packages=find_packages(),
    entry_points={
        "console_scripts": [
            "repotrace=repotrace.cli:main",
        ],
    },
    python_requires=">=3.8",
)
