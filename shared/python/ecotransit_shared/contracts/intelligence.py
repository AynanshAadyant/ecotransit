"""Intelligence job pipeline contracts matching Section 7.1."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from ecotransit_shared.schemas import FitReport, MatrixCell, ResolvedCell


class ICleaningRule(ABC):
    """Cleaning step applied to raw trajectory samples."""

    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def apply(self, samples: Any) -> Any:
        """Takes a DataFrame of samples and returns cleaned DataFrame."""
        ...


class IModel(ABC):
    """Machine learning model contract for traversal duration prediction."""

    @abstractmethod
    def fit(self, X: Any, y: Any) -> FitReport: ...

    @abstractmethod
    def predict(self, X: Any) -> Any: ...

    @abstractmethod
    def save(self, path: Path) -> None: ...

    @classmethod
    @abstractmethod
    def load(cls, path: Path) -> IModel: ...


class IFallbackPolicy(ABC):
    """Policy for resolving a MatrixCell into a ResolvedCell based on sample count & confidence."""

    @abstractmethod
    def resolve(self, cell: MatrixCell) -> ResolvedCell: ...
