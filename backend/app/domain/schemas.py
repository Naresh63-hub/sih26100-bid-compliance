from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator
from datetime import date
Status = Literal['COMPLIANT','NON_COMPLIANT','NEEDS_REVIEW']
class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True, allow_inf_nan=False)
class AssessmentCreate(StrictModel):
    title: str = Field(min_length=1,max_length=240)
    reference: str = Field(min_length=1,max_length=80)
    procuring_entity: str = Field(min_length=1,max_length=240)
    deadline: date
class BidCreate(StrictModel):
    name: str = Field(min_length=1,max_length=240)
class Rule(StrictModel):
    type: Literal['minimum','average','expiry','hybrid','manual','registration']
    key: str = Field(min_length=1,max_length=100)
    minimum: float | None = Field(default=None,ge=0,le=1e9)
    unit: str = Field(default='',max_length=30)
    years: list[str] = Field(default_factory=list,max_length=10)
    required_date: date | None = None
    within_years: int | None = Field(default=None,ge=1,le=50)
    @model_validator(mode='after')
    def consistent(self):
        if self.type in ('minimum','average','hybrid') and self.minimum is None:
            raise ValueError('Numeric rules need a threshold.')
        if self.type=='average' and (not self.years or len(set(self.years))!=len(self.years)):
            raise ValueError('Average rules need unique financial years.')
        if self.type=='hybrid' and self.within_years is None:
            raise ValueError('Hybrid project rule needs a completion window.')
        return self
class RequirementData(StrictModel):
    code: str = Field(min_length=1,max_length=30)
    text: str = Field(min_length=1,max_length=3000)
    category: str = Field(min_length=1,max_length=80)
    mandatory: bool = True
    weight: int = Field(default=10,ge=1,le=100)
    source_document: str
    source_page: int = Field(ge=1,le=100)
    source_chunk: str
    source_quote: str = Field(min_length=1,max_length=10000)
    confidence: float | None = Field(default=None,ge=0,le=1)
    extraction_method: Literal['rules','llm','officer'] = 'rules'
    confirmed: bool = False
    evidence_required: str = Field(min_length=1,max_length=240)
    rule: Rule
class RequirementEdit(StrictModel):
    data: RequirementData
    reason: str = Field(min_length=10,max_length=2000)
class ReviewCreate(StrictModel):
    status: Status
    note: str = Field(min_length=10,max_length=3000)
class AnalyzeRequest(StrictModel):
    bid_id: str
class ExtractRequest(StrictModel):
    document_id: str
    provider: Literal['rules','llm'] = 'rules'
class DecisionCreate(StrictModel):
    decision: Literal['QUALIFIED','DISQUALIFIED','CLARIFICATION']
    note: str = Field(min_length=10,max_length=3000)
