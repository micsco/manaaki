# Ingredient review UX

The previous version presented every ingredient as an expanded form and required
an acknowledgement for uncertain or edited rows. For a recipe with 14 uncertain
ingredients, that added 14 confirmation clicks without correcting any data.

## Research and decisions

- [GOV.UK: Check answers](https://design-system.service.gov.uk/patterns/check-answers/)
  uses a readable summary, targeted Change actions, and one final submission.
  Manaaki now uses compact original/suggestion rows, optional editing, and one
  Save ingredients action. Saving is the user's acceptance of the displayed results.
- [NN/g: Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
  recommends deferring secondary controls to reduce complexity. Matched rows start
  collapsed. Unmatched rows open their editing controls because they require a
  decision. Needs attention appears first, grouping uncertain suggestions, unmatched
  records, and invalid amounts. Ready to save contains matched suggestions and
  retained originals. Recipe order is preserved within each group and when saving.
  Moving between groups retains the active editor and keyboard focus.
- [NN/g: Usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
  emphasizes recognition, error prevention, and user control. Original text stays
  beside the suggestion. Low confidence is a visible warning; only missing record
  matches and invalid quantities block saving. Keep original text is reversible
  through Use parsed suggestion before saving.
- [Carbon: Batch actions](https://carbondesignsystem.com/components/data-table/usage/)
  supports reducing repeated item-level work. One action retains originals for
  all unmatched rows. Resolving a repeated suggested food/unit applies the same
  match throughout this review, without changing quantities or preparation notes.

Explicit creation of foods or units remains separate because it changes the shared
Mealie catalog. No bulk creation or silent acceptance of unknown records is added.
Per-ingredient "I've checked it" boxes and numerical confidence percentages are
removed. The confidence score is a heuristic, not a calibrated correctness promise.

## Validation

Tests cover final-save acceptance without checkboxes, compact editing, invalid
amounts, unmatched records, batch original-text fallback, repeated-name matching,
canceling, and offline behavior. Production mobile tests cover Chromium and WebKit.
These decisions are based on established patterns and functional testing; they
have not yet been evaluated with a user usability study.
