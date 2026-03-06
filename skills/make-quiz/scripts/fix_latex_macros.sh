#!/bin/bash
# Replace custom LaTeX macros with standard MathJax-compatible LaTeX
# in all quiz question .Rmd files. Run from the quiz/ root directory.
#
# Fixes: \bx -> \mathbf{x}, \R -> \mathbb{R}, \wh{} -> \hat{}, etc.

echo "Fixing LaTeX macros in quiz questions..."

find . -type f -name "*.Rmd" -path "./0*/*.Rmd" | while read file; do
    echo "Processing: $file"
    cp "$file" "$file.bak"

    # Bold Greek letters
    sed -i 's/\\bbeta/\\boldsymbol{\\beta}/g' "$file"
    sed -i 's/\\btheta/\\boldsymbol{\\theta}/g' "$file"
    sed -i 's/\\balpha/\\boldsymbol{\\alpha}/g' "$file"
    sed -i 's/\\bDelta/\\boldsymbol{\\Delta}/g' "$file"

    # Bold uppercase letters (matrices)
    for L in A B C D E F G H I J K L M N O P Q R S T U V W X Y Z; do
        l=$(echo "$L" | tr '[:upper:]' '[:lower:]')
        sed -i "s/\\\\b${L}\\([^a-zA-Z]\\)/\\\\mathbf{${L}}\\1/g" "$file"
        sed -i "s/\\\\b${l}\\([^a-zA-Z]\\)/\\\\mathbf{${l}}\\1/g" "$file"
    done

    # Blackboard bold (sets)
    sed -i 's/\\R\([^a-zA-Z]\)/\\mathbb{R}\1/g' "$file"
    sed -i 's/\\N\([^a-zA-Z]\)/\\mathbb{N}\1/g' "$file"
    sed -i 's/\\C\([^a-zA-Z]\)/\\mathbb{C}\1/g' "$file"
    sed -i 's/\\Z\([^a-zA-Z]\)/\\mathbb{Z}\1/g' "$file"

    # Hat and tilde
    sed -i 's/\\wh{\([^}]*\)}/\\hat{\1}/g' "$file"
    sed -i 's/\\wt{\([^}]*\)}/\\tilde{\1}/g' "$file"

    # Epsilon
    sed -i 's/\\eps\([^a-zA-Z]\)/\\varepsilon\1/g' "$file"

    echo "  done"
done

find . -type f -name "*.Rmd.bak" -delete
echo "Done! Run 'Rscript test_rendering.R html' to verify."
