---
title: 0+b = b+0 et le spectre de Frege
tags:
  - verneliba
---
Bienvenue dans la méta-verneliba. Je n'aurais jamais cru en arriver à ce stade. Et j'ose mettre le tag "verneliba", odieuse erreur de typage !

En ce moment je découvre un peu Rocq, un assistant de preuve. Imaginons qu'on veuille construire la preuve de 0+b=b+0. 
L'intuition, c'est que cela va de soi: l'addition ne respecte pas un ordre, qu'on ajoute a à b ou b à a, on a le même résultat. La question apparaît encore plus saugrenue, parce qu'on sait qu'ajouter 0 à quelque chose, ça renvoie juste ce quelque chose. Intuitivement, on sait donc déjà que b=0+b=b+0 . 

# La preuve dans Rocq
Mais on cherche à le prouver. Dans Rocq, l'addition est définie comme une fonction récursive à laquelle on fournit deux arguments (n,k) qui sont des entiers naturels, et qui nous rend un entier naturel. Si n = 0, la fonction renvoie k. 
Si n n'est pas égal à 0, il existe un entier naturel n' qui lui précède. Il est donc successeur. Pour tout successeur de n', la fonction renvoie le successeur (S) de la somme de n' et de k. Comme chaque entier naturel à part 0 est le successeur d'un autre, on est content, on sait faire des additions.
```
Fixpoint addition (n k:nat) := match n with
  | 0 => k 
  | S n' => S (addition n' k)  end.
```
 On peut déjà avancer sur la première partie de la preuve: demander 0+b, c'est se retrouver dans le premier cas de figure décrit dans la définition (le premier des deux arguments est 0). C'est juste "par définition". En général, on peut introduire un lemme qui dit que quand le premier des arguments est 0, additionner cela à n renvoie toujours n. Pour prouver ce lemme, sous l'hypothèse que n est un entier naturel, on doit juste prouver que 0+n=n. Mais c'est contenu dans la définition, alors on peut juste dire simpl., reflexivity. ou trivial. pour envoyer Rocq relire la définition. (Qed. signifie qu'on a bien fini la preuve). Youpi, on a prouvé que 0+b= b.
```
Lemma zero_gauche : forall n, 0+n = n.

intro.
simpl.
trivial. 
Qed.
```
 Mais est-ce qu'on peut introduire un lemme qui dit que b+0=b, c'est-à-dire, que si le deuxième argument est un 0, alors la fonction renvoie le premier argument? 
On peut, mais la preuve est différente, car ce n'est pas un cas de figure prévus dans la définition de l'addition. Pour prouver que n+0=n, on peut s'y prendre par induction sur n. 
On a deux cas de figure: 
 - n = 0, et on doit prouver que 0+0=0. Et c'est formidable, parce qu'on se retrouve dans une addition avec un zéro à gauche, et on peut employer le lemme qu'on vient d'écrire qui nous permet de la simplifier. On dit juste à Rocq "rewrite -> zero_gauche", cela nous amène à devoir prouver 0 = 0. C'est trivial. 
 - n =/= 0, et on doit prouver que S n + 0 = S n. (càd que Le successeur de n + 0 = le successeur de n). On peut le simplifier en S (n+0) = S n grâce à la définition de l'addition. Ensuite, sous l'hypothèse d'induction, n+0=n. On dit à Rocq de revoir cette hypothèse, et on doit prouver S n = S n. Et là, c'est trivial.
```
Lemma zero_droite : forall n, n+0 = n.

intro.
induction n.
rewrite-> zero_gauche.
trivial.
simpl.
rewrite-> IHn.
trivial.
Qed.
```
On voit donc la différence entre une égalité définitionnelle (dans le premier cas) et une égalité propositionnelle, qu'on doit calculer et dont la preuve ne va pas de soi. 

# Le spectre de Frege
Dans l'article de I.Hanzel, on cherche à identifier un critère qui permettrait d'établir que deux *Sinne* sont différents. Le premier critère proposé est:
C1. Two sentences express the same Sinn if and only if they have the same set of
consequences.
L'exemple paradigmatique chez Frege est qu'un même énoncé, à la voix passive ou active, a le même ensemble de conséquences. I.Hanzel cherche ensuite à mettre ce critère à l'épreuve. 

Dans "On Mr.Peano's Conceptual Notation and my Own", Frege écrit: "*Now, if, in a combination of signs ‘F(A)’ which has a Bedeutung, a sign ‘A’ is replaced by another sign ‘D’ with the same Bedeutung, then obviously the new combination of signs will bedeuten the same thing as the original ‘F(A)’. But if the Sinn of ‘D’ deviates from the Sinn of ‘A’, then in general the Sinn of ‘F(D)’ will also deviate from the Sinn of ‘F(A)’.*"

Ainsi, il suffirait de montrer que F(A) et F(D) ont le même *Sinn* pour établir que (A) et (D) ont le même *Sinn*. Gardons en tête que dans Rocq, on essayait de montrer l'équivalence entre deux fonctions qui, pour l'une, à 0+b associait b, et pour l'autre, à b+0 associait b. 
I.Hantzel remarque que, d'une part, "_due to Frege's logicism in his construction of arithmetic_", on peut prouver que "_for any natural numbers, x and y holds ‘x + y = y + x’. As a result of this, one could derive ‘F(y + x)’ from ‘F(x + y)’ only by using the rules of logic, i.e. they should express the same Sinn. Then, of course, ‘x + y’ and ‘y + x’ should be synonymous, e.g. ‘3 + 1’ and ‘1 + 3’ should express the same Sinn; otherwise ‘F(y + x)’ and ‘F(x + y)’ would express a different Sinn, which would contradict Frege’s views just quoted above._". Mais cela ne va pas avec une affirmation de Frege, dans le même chapitre: "_Thus I also say of the *Bezeichnungen* ‘‘3 + 1’’, ‘‘1 + 3’’(...), that they *bedeuten* the same thing, but have different *Sinne*, or express different things_."

(I.Hanzel en conclut qu'il faut abandonner le premier critère et chercher ailleurs la distinction entre *Sinne*).

# Mes idées en vrac
Ainsi, Frege considèrerait que 0+b et b+0 (et probablement aussi b), ont la même *Bedeutung*, mais des *Sinne* différents. 
C'est-à-dire que ces termes, pris en input, renverraient le même output (b), mais que le programme suivrait un processus différent. Pour reformuler, de tous ces termes, on peut dériver b, mais la preuve en est différente. C'est exactement ce qu'on voit avec Rocq.
Soyons un peu précis. Il s'agit toujours de la même fonction: l'addition. Ce qui diffère, ce sont les arguments et la preuve, c'est-à-dire, l'exécution du programme.
Je propose un gribouillage préliminaire:
![[correspondances.png]]
Et avec la correspondance Curry-Howard, il faudrait ajouter une ligne dans laquelle la flèche correspond à la preuve. J'espère travailler sur cela prochainement. 

Dans le chapitre 1 "Sense, denotation and semantics" de *Proofs and Types*, une grande division est faite, entre, d'une part, le sens, la syntaxe, les preuves ; d'autre part, la dénotation, la vérité, la sémantique et les opérations algébriques. L'idée de Heyting, instigateur d'une tradition sémantique (et proche de l'intuitionnisme de Brouwer), est présentée ainsi:

"_Instead of asking the question "when is a sentence A true?", we ask "what is a proof of A?". By proof we understand not the syntactic formal transcript, but the inherent object of which the written form gives only a shadowy reflection. We take the view that what we write as a proof is merely a description of something which is already a process in itself. So the reply to our extremely ambitious question (and an important one, if we read it computationally) cannot be a formal system._"
Honnêtement, il y a beaucoup de choses que je ne comprends pas encore dans cette définition de la preuve. Je dois encore explorer et ne pas oublier qu'il s'agit d'un manuel d'informatique théorique et pas de philosophie (même si la description "the inherent object of which the written form gives only a shadowy reflection" aurait de quoi faire rougir Hegel).

Pour l'instant, je ne sais pas comment poursuivre cette réflexion.

25 septembre 2026

Restons dérangés,
[[Qui suis-je|N]].

# Sources: 
"Sense, denotation and semantics", *Proofs and Types* - Cambridge Tracts in Theoretical Computer Science 7, J. Girard, Y. Lafont, P. Taylor
I. Hanzel (2006) Frege, the identity of Sinn and Carnap's intension, *History and Philosophy of Logic*, 27:3, 229-247, DOI: 10.1080/01445340600780432