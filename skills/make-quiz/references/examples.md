# Example Quiz Questions

One example per question type. Use these as templates.

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

# Calculate trace
spur <- a11 + a22 + a33
```

Question
========
Berechnen Sie die Spur der folgenden Matrix:

$$\mathbf{A} = \begin{pmatrix} `r a11` & `r a12` & `r a13` \\ `r a21` & `r a22` & `r a23` \\ `r a31` & `r a32` & `r a33` \end{pmatrix}$$

Solution
=========
Die Spur einer Matrix ist die Summe ihrer Diagonalelemente:

$$\text{tr}(\mathbf{A}) = a_{11} + a_{22} + a_{33} = `r a11` + `r a22` + `r a33` = `r spur`$$

Meta-information
================
extype: num
exsolution: `r spur`
exname: Spur berechnen
extol: 0
```

## schoice: Conceptual single-choice

```r
```{r data generation, echo = FALSE, results = "hide"}
# Difficulty: Easy
```

Question
========
Was bedeutet es, wenn ein numerisches Problem **schlecht konditioniert** ist?

Answerlist
----------
* Ein kleiner Fehler in den Eingangsdaten fuehrt zu einem grossen Fehler im Ergebnis.
* Der Algorithmus zur Loesung des Problems ist sehr langsam.
* Das Problem kann nicht exakt geloest werden.
* Der benoetigte Speicherplatz ist sehr gross.
* Die Implementierung des Algorithmus ist kompliziert.

Solution
========
Ein schlecht konditioniertes Problem ist dadurch charakterisiert, dass kleine Aenderungen
oder Fehler in den Eingangsdaten zu grossen Aenderungen im Ergebnis fuehren koennen.
Dies ist eine Eigenschaft des **Problems selbst**, nicht des verwendeten Algorithmus.

Answerlist
----------
* Richtig. Dies ist die Definition von schlechter Konditionierung: hohe Sensitivitaet des Outputs bzgl. Aenderungen im Input.
* Falsch. Die Geschwindigkeit eines Algorithmus haengt von seiner Komplexitaet ab, nicht von der Kondition des Problems.
* Falsch. Viele Probleme koennen nicht exakt geloest werden (z.B. wegen Rundungsfehlern), aber das hat nichts mit Kondition zu tun.
* Falsch. Speicherbedarf ist eine Frage der Komplexitaet, nicht der Kondition.
* Falsch. Die Implementierungsschwierigkeit ist unabhaengig von der Kondition des Problems.

Meta-information
================
exname: Kondition Definition
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
Welche der folgenden Aussagen ueber die Spur einer Matrix $\mathbf{A} \in \mathbb{R}^{n \times n}$ sind korrekt?

Answerlist
----------
* $\text{tr}(\mathbf{A}\mathbf{B}) = \text{tr}(\mathbf{B}\mathbf{A})$ (zyklische Eigenschaft)
* $\text{tr}(\mathbf{A}^\top) = \text{tr}(\mathbf{A})$
* $\text{tr}(\mathbf{A}\mathbf{B}) = \text{tr}(\mathbf{A}) \cdot \text{tr}(\mathbf{B})$
* $\text{tr}(\mathbf{I}_n) = n$
* Wenn $\mathbf{A}$ invertierbar ist, dann $\text{tr}(\mathbf{A}^{-1}) = 1/\text{tr}(\mathbf{A})$

Solution
========
Die Spur hat mehrere wichtige Eigenschaften, aber nicht alle intuitiven Vermutungen sind korrekt.

Answerlist
----------
* Richtig. Dies ist die wichtige **zyklische Eigenschaft** der Spur.
* Richtig. Die Spur ist **transpositionsinvariant**, da die Diagonalelemente bei Transposition unveraendert bleiben.
* Falsch. Die Spur des Produkts ist im Allgemeinen **nicht** das Produkt der Spuren. Gegenbeispiel: $\mathbf{I}_2$ hat $\text{tr}(\mathbf{I}_2) = 2$, aber $\text{tr}(\mathbf{I}_2 \mathbf{I}_2) = 2 \neq 4$.
* Richtig. Die Identitaetsmatrix $\mathbf{I}_n$ hat $n$ Einsen auf der Diagonale, also $\text{tr}(\mathbf{I}_n) = n$.
* Falsch. Gegenbeispiel: Fuer $\mathbf{A} = 2\mathbf{I}_2$ gilt $\text{tr}(\mathbf{A}^{-1}) = 1 \neq 1/4 = 1/\text{tr}(\mathbf{A})$.

Meta-information
================
exname: Spur Eigenschaften
extype: mchoice
exsolution: 11010
exshuffle: FALSE
```
