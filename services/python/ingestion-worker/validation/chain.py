"""Composite ValidationChain coordinating rule execution."""

from __future__ import annotations

import logging
from collections.abc import Sequence

from ecotransit_shared.contracts.ingestion import IValidationRule
from ecotransit_shared.schemas import ValidationContext, ValidationResult, VehiclePosition

logger = logging.getLogger("ingestion.validation.chain")


class ValidationChain:
    """Runs validation rules in order, short-circuiting on the first rejection.

    Follows Open/Closed principle: adding new rules requires no modification to this class.
    """

    def __init__(self, rules: Sequence[IValidationRule]) -> None:
        self._rules = tuple(rules)

    @property
    def rules(self) -> tuple[IValidationRule, ...]:
        return self._rules

    def evaluate(
        self, position: VehiclePosition, context: ValidationContext
    ) -> ValidationResult:
        for rule in self._rules:
            outcome = rule.check(position, context)
            if not outcome.passed:
                return ValidationResult(
                    valid=False,
                    failed_rule=outcome.code,
                    failure_reason=outcome.reason,
                )

        return ValidationResult(valid=True)
