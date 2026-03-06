# Example Quiz Questions

One example per question type. Use these as templates. Adapt language to match the course.

## num: Parametrized numerical calculation

```r
```{r data generation, echo = FALSE, results = "hide"}
# Difficulty: Easy
library(exams)

# Generate random 3x3 matrix with small integers
set.seed(NULL)
a11 <- sample(-3:5, 1)
a22 <- sample(-3:5, 1)
a33 <- sample(-3:5, 1)
a12 <- sample(-2:4, 1)
a13 <- sample(-2:4, 1)
a21 <- sample(-2:4, 1)
a23 <- sample(-2:4, 1)
a31 <- sample(-2:4, 1)
a32 <- sample(-2:4, 1)

trace_A <- a11 + a22 + a33
```

Question
========
Compute the trace of the following matrix:

$$\mathbf{A} = \begin{pmatrix} `r a11` & `r a12` & `r a13` \\ `r a21` & `r a22` & `r a23` \\ `r a31` & `r a32` & `r a33` \end{pmatrix}$$

Solution
=========
The trace of a matrix is the sum of its diagonal elements:

$$\text{tr}(\mathbf{A}) = a_{11} + a_{22} + a_{33} = `r a11` + `r a22` + `r a33` = `r trace_A`$$

Meta-information
================
extype: num
exsolution: `r trace_A`
exname: Trace computation
extol: 0
```

## schoice: Conceptual single-choice

```r
```{r data generation, echo = FALSE, results = "hide"}
# Difficulty: Easy
```

Question
========
What does it mean for a numerical problem to be **ill-conditioned**?

Answerlist
----------
* A small error in the input data leads to a large error in the output.
* The algorithm for solving the problem is very slow.
* The problem cannot be solved exactly.
* The required memory is very large.
* The implementation of the algorithm is complicated.

Solution
========
An ill-conditioned problem is characterized by high sensitivity of the output
to small changes in the input. This is a property of the **problem itself**,
not of the algorithm used to solve it.

Answerlist
----------
* Correct. This is the definition of ill-conditioning: high sensitivity of the output to input perturbations.
* Wrong. Algorithm speed depends on computational complexity, not on the condition of the problem.
* Wrong. Many problems cannot be solved exactly (e.g., due to rounding errors), but that is unrelated to conditioning.
* Wrong. Memory requirements are a matter of complexity, not conditioning.
* Wrong. Implementation difficulty is independent of the condition of the problem.

Meta-information
================
exname: Conditioning definition
extype: schoice
exsolution: 10000
exshuffle: FALSE
```

## mchoice: Properties with true/false mix

```r
```{r data generation, echo = FALSE, results = "hide"}
# Difficulty: Medium
```

Question
========
Which of the following statements about the trace of a matrix $\mathbf{A} \in \mathbb{R}^{n \times n}$ are correct?

Answerlist
----------
* $\text{tr}(\mathbf{A}\mathbf{B}) = \text{tr}(\mathbf{B}\mathbf{A})$ (cyclic property)
* $\text{tr}(\mathbf{A}^\top) = \text{tr}(\mathbf{A})$
* $\text{tr}(\mathbf{A}\mathbf{B}) = \text{tr}(\mathbf{A}) \cdot \text{tr}(\mathbf{B})$
* $\text{tr}(\mathbf{I}_n) = n$
* If $\mathbf{A}$ is invertible, then $\text{tr}(\mathbf{A}^{-1}) = 1/\text{tr}(\mathbf{A})$

Solution
========
The trace has several important properties, but not all intuitive guesses are correct.

Answerlist
----------
* Correct. This is the important **cyclic property** of the trace.
* Correct. The trace is **invariant under transposition** since diagonal elements are unchanged.
* Wrong. The trace of a product is generally **not** the product of traces. Counterexample: $\text{tr}(\mathbf{I}_2 \mathbf{I}_2) = 2 \neq 4 = \text{tr}(\mathbf{I}_2) \cdot \text{tr}(\mathbf{I}_2)$.
* Correct. The identity matrix $\mathbf{I}_n$ has $n$ ones on the diagonal, so $\text{tr}(\mathbf{I}_n) = n$.
* Wrong. Counterexample: For $\mathbf{A} = 2\mathbf{I}_2$, $\text{tr}(\mathbf{A}^{-1}) = 1 \neq 1/4 = 1/\text{tr}(\mathbf{A})$.

Meta-information
================
exname: Trace properties
extype: mchoice
exsolution: 11010
exshuffle: FALSE
```
