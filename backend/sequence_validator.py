# sequence_validator.py

VALID_AA = set("ACDEFGHIKLMNPQRSTVWY")  # 20 canonical one-letter codes

def validate_protein_sequence(seq: str):
    """
    Validates a raw protein sequence string.
    Returns the cleaned sequence if valid.
    Raises ValueError with a descriptive message if invalid.
    """

    if not seq:
        raise ValueError("Sequence is empty.")

    # Remove whitespace around the sequence
    seq = seq.strip()

    # FASTA header?
    if seq.startswith(">"):
        raise ValueError("FASTA headers are not allowed. Provide the raw sequence only.")

    # Remove internal spaces (NOT allowed)
    if " " in seq:
        raise ValueError("Sequence contains spaces. Provide a continuous string of amino acids.")

    # Must be uppercase; convert if user input is lowercase
    seq = seq.upper()

    # Check characters
    bad = [c for c in seq if c not in VALID_AA]
    if bad:
        raise ValueError(
            f"Invalid amino acids found: {' '.join(bad)}. "
            f"Allowed: {''.join(sorted(VALID_AA))}"
        )

    # Length constraints to prevent abuse
    if len(seq) < 10:
        raise ValueError("Sequence too short. Must be at least 10 amino acids.")
    if len(seq) > 2000:
        raise ValueError("Sequence too long. Maximum allowed is 2000 amino acids.")

    return seq