---
title: Des mots qui se ressemblent mais qui n'ont rien à voir
tags:
  - revuedarticle
  - philodulangage
  - philocognitive
---

Spoiler, les mots en question sont: intensionnalité, ultraintensionnalité, hyperintensionnalité...Et je suis quasi-sûre d'avoir vu passer extra-intensionnalité mais à ce stade c'est peut-être juste une invention des voix dans ma tête!

On peut souvent parler d'une même chose de plusieurs manières. Par exemple, il existe un objet précis dans le monde auquel on peut se référer en disant "la tour Eiffel", mais aussi en disant "la tour construite par Gustave Eiffel" ou encore "la tour construite pour l'exposition universelle de Paris de 1889". Toutes ces expressions sont des concepts sous lequel tombe le même objet. On peut penser aux concepts comme à des ensembles qui contiennent des objets (par exemple, le concept "chien" contient chaque chien particulier qui existe dans le monde, et le concept "tour Eiffel" contient la tour portante parisienne qu'on connaît tous). 
Tous les concepts qui contiennent la tour Eiffel et que j'ai cités plus haut peuvent être envisagés comme des ensembles qui ont cette tour pour unique élément. Si on devait en faire un diagramme de Venn, on serait bien embêté, car ces ensembles se comprennent mutuellement: on se retrouverait avec des cercles exactement superposés sur un plan, et on ne verrait qu'un seul cercle. 
Y'a-t-il jamais eu plusieurs ensembles, ou n'était-ce, depuis le début, que le même concept? Toutes ces expressions semblent n'avoir été que des façons de parler du même objet : utiliser l'une ou l'autre, cela reviendrait au même. En fait, elles sont extensionnellement équivalentes, mais intensionnellement différentes.
## La distinction entre extensionnalité et intensionnalité
On fait souvent remonter cette distinction à Carnap. Avant lui, on peut déjà évoquer Frege, qui distingue le sens (_Sinn_) et la référence (_Bedeutung_). 

| Sinn (Sens)                     | Bedeutung (Référence)            | distinction chez Frege     |
| ------------------------------- | -------------------------------- | -------------------------- |
| Intension                       | Extension                        | distinction chez Carnap    |
| Trait définitoire: x tel que... | Liste des éléments de l'ensemble | explication                |
| Tous les x qui sont des chiens  | Milou, Mirza, Trévor...          | exemple en langage naturel |
## Functions as sets - That which we call a rose
L'exemple que prend Frege, c'est celui de Vénus, un objet (oui, une planète) qui tombe sous les deux concepts  "l'étoile du soir" et "l'étoile du matin". Pour le reformuler, c'est l'unique élément de l'ensemble "l'étoile du soir", ainsi que celui de l'ensemble "l'étoile du matin".
Imaginons une fonction f "est l'étoile du matin" qui renvoie, pour un argument x, un résultat y de type vrai ou faux. 
Par exemple, pour x = "mon chat", f(x) = faux. Car "mon chat est l'étoile du matin" est faux. 
En revanche, pour x = "Vénus", f(x) = vrai.
Imaginons une fonction g "est l'étoile du soir" qui renvoie elle aussi vrai ou faux. 
Pour x = "Vénus", g(x)=vrai. 
x est donc un argument associé à la même valeur (vrai) par la fonction f et par la fonction g. 

![schéma](.assets/figures/schema1.jpeg)

La théorie des ensembles propose de se représenter une fonction comme un ensemble de paires ordonnées. On écrit (x,y)∈g pour parler de la fonction g qui à l'argument x associe le résultat y. 
Or, la fonction f "est l'étoile du matin" et la fonction g "est l'étoile du soir" associent les mêmes valeurs aux mêmes argument: pour x = "Vénus", elles renvoient y= vrai, et pour n'importe quel autre x, elles renvoient y= faux. 
On peut donc écrire (x, y)∈f ⇔ (x, y)∈g. 
Les fonctions f et g sont donc appréhendées comme deux ensembles qui ont la même extension. Mais si deux ensembles A et B contiennent les mêmes éléments, ne s'agit-il pas en fait du même ensemble? En théorie des ensembles, _l'axiome d'extensionnalité_ dit que deux ensembles sont égaux ssi ils ont les mêmes éléments.
On peut l'écrire ainsi:
∀A ∀B [∀x (x ∈ A ⇔ x ∈ B) ⇒ A = B] (pour tout ensemble A et B, si tout élément x de A appartient à B et si tout élément x de B appartient à A, alors les ensembles A et B sont égaux).
Cela revient à une double inclusion (A est inclu dans B et B est inclu dans A) : dans un diagramme de Venn, les deux ensembles seraient strictement superposés. On peut donc aussi écrire l'axiome d'extensionnalité ainsi : (_A_ ⊂ _B_ et _B_ ⊂ _A_) ⇒ _A_ = _B_. 
Nous revoilà au point fait dans la conclusion: depuis le début, ces deux concepts qui semblaient différents ne font qu'un, dans la théorie des ensembles du moins: ils sont **intersubstituables**. 

Le principe d'extensionnalité peut aussi être appelé principe de substituabilité des identiques chez Quine, ou principe d'invariance, en théorie des jeux et de la décision. J.L Bermúdez s'y réfère en citant le _Romeo and Juliette_ de Shakespeare : "_What’s in a name? That which we call a rose/By any other name would smell as sweet._” (Bermúdez JL. (2022)).
## Mise en échec du principe d'extensionnalité
Des contre-exemples montrent que l'extensionnalité ne suffit pas dans certains contextes, dits opaques : deux fonctions/ensembles/concepts ne sont pas substituables du seul fait qu'ils ont la même extensionnalité. 
### Contexte de connaissance 
Pour le dire extrêmement rapidement: 
Dire "L'étoile du matin est l'étoile du matin" et "L'étoile du matin est l'étoile du soir", ce n'est pas la même chose. "L'étoile du matin est l'étoile du matin" est une tautologie, une lapalissade ou encore ce que Locke appellerait une proposition frivole (_triffling proposition_), car le même est affirmé du même. 
On sait que l'étoile du matin est l'étoile du matin - il semblerait absurde de ne pas le savoir. S'il y a une seule chose qu'on sait de l'étoile du matin, c'est que c'est l'étoile du matin. Mais on peut complètement ignorer que l'étoile du matin est l'étoile du soir ; énoncer cette équivalence extensionnelle a une certaine pertinence épistémique. 
Se référer à la même extension (la même liste d'objet, ou le même objet unique) par deux intensions différentes, c'est introduire ce que Quine appelle une "opacité référentielle".
C'est le ressort tragique du mythe d'Oedipe, qui tue son père (conformément à l'oracle) sans l'identifier comme tel. Il pense tuer un vieil homme quelconque lors d'une altercation, mais il se trouve que cet homme est _aussi_ son père Laïos. L'unique objet _x_ de l'ensemble "vieil homme avec lequel Oedipe se dispute" est aussi l'unique objet de l'ensemble "Laïos, père d'Oedipe". Les deux ensembles sont extensionnellement équivalents, mais cela échappe à Oedipe à cause de leur différence intensionnelle.

| contexte extensionnel ou non-intensionnel                                                                                                                                                                                                                                                       | contexte intensionnel                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Oedipe a tué l'homme qu'il a croisé" est vraie. Le x qui correspond à l'homme qu'il a croisé est aussi le x qui correspond à son père Laïos. En vertu de la substituabilité des identiques, si "Oedipe a tué l'homme qu'il a croisé" est vraie, alors "Oedipe a tué son père Laïos" est vraie. | "Oedipe sait qu'il a tué l'homme qu'il a croisé" est vraie. L'homme qu'il a croisé se trouve aussi être son père Laïos. Mais en vertu de l'opacité référentielle, il est faux de dire que si "Oedipe sait qu'il a tué l'homme qu'il a croisé" est vraie, alors "Oedipe sait qu'il a tué son père Laïos" l'est nécessairement aussi. Dans ce cas, la première phrase est vraie, et la deuxième est fausse.  |

Ainsi, il est nécessaire de prendre en compte l'intensionnalité pour comprendre le comportement d'Oedipe. Pire encore, J.L Bermúdez rapporte l'existence de contextes ultraintensionnels, dans lesquels les agents adoptent des motifs de préférence quasi-cycliques (_patterns of quasi-cyclical preferences_), incompréhensibles sur le plan extensionnels mais parfaitement intelligibles sur le plan intensionnel. 

Concrètement, sur le plan extensionnel, cela consiste à simultanément préférer A à B et B à C (A>B ^ B>C ^ C>A). Étant donné l'*équivalence extensionnelle* de C et A (A <=> C), et en vertu de la *substituabilité des identiques*, préférer B à C revient à préférer B à A ((B>C)<=>(B>A)). Finalement, cela revient à préférer A à B et B à A ((A>B)^(B>A)), ce qui est contradictoire (et de cette contradiction, selon le principe d'explosion ou _ex falso quodlibet_, tout le système s'écroule).

J.L Bermúdez prend l'exemple de l'_Agamemnon_ d'Eschyle. Pour résumer grossièrement, Artémis exige d'Agamemnon qu'il lui sacrifie sa fille, Iphigénie, en échange de quoi elle accepte de laisser sa flotte et son honneur saufs. Agamemnon dit simultanément préférer sauver sa flotte au moyen d'un sacrifice à Artemis (A) plutôt que condamner sa flotte (B), et préférer condagardemner sa flotte (B) plutôt que tuer sa fille (C). Il préfère l'option A à l'option B, et l'option B à l'option C. Cela n'apparaît comme contradictoire que lorsqu'on réalise que A et C sont extensionnellement équivalents (car le sacrifice qu'exige Artemis se trouve être le meurtre de sa fille). Sur le plan extensionnel, Agamemnon préfère A à B, et B à C soit B à A. Il préfère donc simultanément A à B et B à A, ce qui est inconsistant. Pourtant, sur le plan intensionnel, le raisonnement d'Agamemnon est parfaitement intelligible. Tout comme une pièce a (au moins) deux faces, une même action peut simultanément être décrite en termes de gain, comme un sacrifice capital pour épargner la vie de soldats, et en termes de perte, comme un infanticide immonde (et comme beaucoup d'autres choses encore). Et ces descriptions sont autant de perspectives qui nous font considérer l'action autrement, en rendant saillants différents de ses aspects.

Bermúdez défend, dans son article, que prendre une décision différente selon la manière dont une option est présentée, c'est-à-dire enfreindre le principe d'extensionnalité ou d'invariance, n'est pas forcément irrationnel : c'est une façon de saisir les implications, toutes les perspectives, d'une même option. 
Il s'oppose en fait à la réception classique d'un biais cognitif nommé [[Fanzine informel - Risky-choice framing and rational decision-making|l'effet de cadrage ou _framing effect_]]. Ce biais consiste à agir différemment face à une même information, selon la manière dont elle nous est présentée, et la littérature a tendance à le présenter comme une preuve, parmi d'autres biais cognitifs, de l'irrationnalité humaine. On pourrait dire que Bermúdez montre que ce qui est décrié comme irrationnel du point de vue de l'extensionnalité peut être rationnel du point de vue de l'intensionnalité. Ainsi, forcer une lecture extensionnelle dans un contexte intensionnel, ce serait comme utiliser un instrument inadapté, impropre à satisfaire les conditions d'intelligibilité de ce contexte.
### Contexte de nécessité
Pour le dire extrêmement rapidement: 
L'étoile du matin est nécessairement l'étoile du matin. En est-il de même pour "l'étoile du matin est l'étoile du soir"? Il n'apparaît pas que l'étoile du matin soit nécessairement l'étoile du soir. On peut imaginer d'autres mondes où l'étoile du soir n'est précisément pas l'étoile du matin. Rien, dans le concept "étoile du matin" n'implique qu'il s'agit aussi de "étoile du soir" ; et rien n'exclut a priori que ces deux concepts aient une extension différente. 

Pour reprendre un exemple classique, "9" est l'unique élément des ensembles "est le successeur de 8" et "est le nombre de planètes" (ou bien, selon la terminologie _functions-as-sets_, les deux fonctions renvoient "vrai" lorsqu'elles prennent "9" comme argument. Et en terme ensemblistes, les deux ensembles ont pour objet (9;vrai)). On peut donc en conclure qu'ils sont extensionnellement équivalents. Pourtant, le principe d'extensionnalité qui autorise à substituer les identiques semble être mis en échec dans un certain contexte, celui de la nécessité () et inversement de l'impossibilité.

| prémisse majeure                          | prémisse mineure              | conclusion                                                               |
| ----------------------------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| "9, par nécessité est le successeur de 8" | "9 est le nombre de planètes" | "le successeur de 8, par nécessité, est le nombre de planètes"<br>= FAUX |

La prémisse mineure nous montre une équivalence extensionnelle (9 doit ici être compris comme un troisième nom et pas un objet) : le principe de substituabilité étant de mise, on peut être tenté de substituer dans la majeure "9" par "le nombre de planètes". Mais cela nous amène à conclure faussement "le successeur de 8, par nécessité, est le nombre de planètes". 
Il est intuitif que c'est faux, mais on peut le préciser : la nécessité est ici entendue comme une vérité _analytique_. Que 9 soit le successeur de 8, cela peut être obtenu par analyse, donc il est vrai que 9 est nécessairement le successeur de 8. Que le successeur de 8 soit le nombre de planètes, cela n'est pas obtenu par analyse, et cela n'est pas nécessaire. Le principe d'extensionnalité nous a induit en erreur. 

Très intuitivement, pour expliquer pourquoi 9 est nécessairement le successeur de 8, on peut être tenté de dire qu'il l'est "par définition". Or, cette idée de "par définition" renvoie précisément à l'intension. Au contraire, on pourrait dire que le nombre de planètes "se trouve être" le successeur de 8, sans aucune nécessité, car il apparaît clair que ces deux ensembles ont la même extension de façon parfaitement contingente. Mais, si nous revenons en contexte extensionnel, tous ces noms (9, le successeur de 8, le nombre de planètes) désignent la même entité: comment une seule entité peut-elle être simultanément nécessairement le successeur de 8, et non nécessairement le successeur de 8? 

La généralisation existentielle permet de mettre à jour ce paradoxe. Le tableau ci-dessous se lit de gauche à droite. Au sein d'une case, chaque proposition logique est suivie de son expression formelle (pour se familiariser).

| proposition                                                                                                                                                                                                                              | proposition, après la généralisation existentielle                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9, par nécessité, est le successeur de 8.<br><br> (9 est le successeur de 8))<br>                                                                                                                                                       | il existe un x qui, nécessairement, est le successeur de 8.<br><br>(∃x)  (x est le successeur de 8))                                                                                       |
| (1) Le successeur de 8 est le nombre de planètes, et le successeur de 8 est nécessairement le successeur de 8.<br><br>(le successeur de 8 est le nombre de planètes et  (le successeur de 8 est le successeur de 8))<br>                | (1') il existe un x tel qu'il est le nombre de planètes, et tel qu'il est nécessairement le successeur de 8.<br><br>(∃x) (x est le nombre de planètes et  (x est le successeur de 8))      |
| (2) Le nombre de planètes est le successeur de 8, et le nombre de planètes n'est pas nécessairement le successeur de 8.<br><br>(le nombre de planètes est le successeur de 8 et ∼  (le nombre de planètes n'est pas le successeur de 8) | (2') Et il existe un x tel qu'il est le successeur de 8, et tel qu'il n'est pas nécessairement le successeur de 8.<br><br>(∃x) (x est le successeur de 8 et ∼  (x est le successeur de 8)) |

Une entité ne peut pas simultanément être le x de (1') et celui de (2'), car cela impliquerait d'être et de ne pas être par nécessité le successeur de 8. C'est un problème soulevé par Quine en 1947, dans "_The problem of interpreting modal logic_", et que Ballarin résume ainsi dans son article : "_only one of “F a” and “F b” is analytically true despite the co-referentiality of “a” and “b”_". 
On semblerait dès lors avoir deux 9: l'un qui est par nécessité le successeur de 8, l'autre qui ne l'est pas. Cette multiplication ontologique (d'objets ou de concepts individuels) est un peu dérangeante et amène Quine à rejeter la logique modale (car il ne veut pas renoncer au point de vue extensionnaliste).
(Je vous recommande la lecture de l'article pour une explication vraiment en profondeur des paradoxes qui émergent suite à l'introduction de quantificateurs existentiels en logique modale (Ballarin, R (2012))
## Formaliser l'intensionnalité
On a donc vu que l'intensionnalité semble simultanément être quelque chose de vague, d'un peu fantasque (car, peu importe la façon dont on décrit une chose: il s'agit de la même chose, et c'est cela qui compte, intuitivement). En même temps, il semble qu'elle est profondément liée au concept de signification, et qu'on ne peut pas s'en passer dans un certain nombre de contextes. Comment faire droit à l'intensionnalité? 
### Retrouver l'intensionnalité en terme extensionnels par les langages modaux
Contrairement à Quine, qui refuse la logique modale par extensionnalisme, on pourrait se servir de la logique modale pour asseoir l'intensionnalisme. On pourrait tenter de formaliser l'intensionnalité en la comprenant comme l'extensionnalité dans tous les mondes possibles. Il s'agirait de rendre compte de la différence intensionnelle entre deux ensembles comme d'une différence extensionnelle dans tous les mondes possibles. 

 On dit: Si deux ensembles ont la même extension, ils sont équivalents extensionnellement. 
 Si deux ensembles n'ont pas la même extension, ils ne sont pas équivalents extensionnellement. 
 De la même manière, on pourrait dire: Si deux ensembles n'ont pas la même extension dans tous les mondes possibles, ils ne sont pas équivalents intensionnellement. 
 Cela suggère, en creux, que si deux ensembles ont la même extension dans tous les mondes possibles, ils sont équivalents intensionnellement. 
 Deux contre-exemples permettent d'évaluer cette conséquence et peuvent amener à rejeter cette tentative. 
### Mise en échec de la formalisation de l'intensionnalité par le langage modal : l'hyperintensionnalité
Le problème est qu'il existe des termes extensionnellement équivalents, ou co-référentiels, dans tous les mondes possibles, pour lesquels le principe de substituabilité ne s'applique toujours pas. 
"Le centième nombre premier" et "541" ont nécessairement la même extension, dans ce monde et dans tous les mondes possibles. Mais je peux savoir que le centième nombre premier est le centième nombre premier, et ne pas savoir que le centième nombre premier est 541. 
Tout se passe comme si, en dépit de leur équivalence nécessaire au sens analytique, ils n'étaient pas équivalents en essence ou en nature, ce qui empêche de les substituer. Deux conceptions différentes de la nécessité sont sous-tendues : la nécessité par analyse et la nécessité par essence (et Ballarin, R. évoque dans son article cet essentialisme tout aristotélicien qui émerge lorsqu'on essaie de faire des généralisations existentielles sur des propositions de logique modale). 
### Functions as rules ?
Dans la section intitulée "Functions as sets", je suis partie de la présentation habituelle du langage comme d'une manière de mettre en lien deux ensembles différents. Le premier ensemble contient l'objet qu'on désigne, ou le nom de l'objet dont on dit à quoi il se réfère. Le second ensemble contient la valeur de vérité. Ce lien entre deux ensembles peut être appréhendé comme une fonction qui prend le premier ensemble en argument et renvoie le deuxième ensemble. Mais les fonctions peuvent être appréhendées simultanément comme des ensembles, selon le paradigme function-as-sets que j'ai décrit plus haut, et comme des instructions ou des programmes. Il semble que la différence intensionnelle soit une différence dans la manière dont on arrive, d'un input, à un output. Pour le dire autrement, il semble que cela porte sur la manière dont on produit les choses et non les choses en elles-mêmes - et on fait parfois référence à l'intension en disant qu'il s'agit de "_ways of phrasing_". 
La théorie des types, et particulièrement le lambda-calcul, permettent de penser les fonctions comme des règles, c'est-à-dire en faisant droit à l'action qu'effectue la fonction. La page de l'encyclopédie Stanford dit que non, mais cela me semble prometteur pour penser l'intensionnalité qui est manifestement liée au processus et à l'action dans le temps, et non pas au résultat (les ensembles en bijection que l'on regarde de loin, l'arbre de déduction fini que l'on peut remonter analytiquement d'un coup d'oeil). Je pense que la finitude et la lenteur humaine sont vraiment au coeur de la question de la différence entre intensionnalité et extensionnalité, en tant que c'est ce qui nous empêche de voir les équivalences extensionnelles et nous rend incapable d'appliquer le principe de substituabilité. 
Toute ma vie, je me battrai pour sortir de ce labyrinthe et prendre du recul (et ce fantasme naïf est vertueux en tant qu'idée régulatrice, à la façon du surhomme nietzschéen).
### Après la formalisation de l'intensionnalité
Pouvoir traiter l'entièreté du langage naturel de manière extensionnelle autorise en principe à faire traiter l'entièreté du langage naturel par une machine ou un programme informatique. C'est une condition nécessaire, mais est-ce suffisant? C'est une question posée dans le chapitre 6 de _La philosophie du langage_, en faisant l'hypothèse d'un programme qui prend en charge l'ensemble des éléments d'une langue naturelle : "L'ordinateur où on l'implémente sera-t-il capable, pour autant, d'un comportement linguistique humain ?". Les auteurs répondent par la négative en évoquant des patients (qui semblent être atteints d'agnosie) qui "dominent parfaitement la construction du langage naturel mais ont perdu l'aptitude de le rapporter au monde qu'ils perçoivent". Ils poursuivent: "pour parler, il ne suffit pas de faire des phrases correctes, il faut encore les ancrer dans le monde perçu". 
Turing en avait certainement l'intuition : son dernier projet était ces structures qui portent son nom, des ordinateurs dotés d'un corps et d'une sensorialité (l'idée de Turing était de ramener, selon la légende urbaine, son amour de jeunesse, mort alors qu'il n'avait que 17 ans). 
Mais j'ai l'intuition que la formalisation de l'intensionnalité que pourrait permettre la théorie des types n'est pas sans lien avec le corps, en tant que les fonctions sont prises comme des actions, et que ces actions supposent un agent ou une force, en bref du mouvement et du contraste.

(Nous n'avons que 8 planètes depuis 2006, si une chose est à retenir.)

2 septembre 2026

Restons dérangées,
[[Qui suis-je|N]].

Sources:
-Auroux, S., Deschamps, J., Kouloughli, D.; (2004), "Pensée et langage", _La philosophie du langage_, Presses Universitaires de France, ISSN 0291-0489

-Ballarin R. (2012), "*Quine on intensional entities: Modality and quantification, truth and satisfaction*", Journal of Applied Logic, Volume 10, Issue 3, 2012, Pages 238-249,
ISSN 1570-8683, https://doi.org/10.1016/j.jal.2012.04.001.

-Bermúdez JL. (2022) "Rational framing effects: A multidisciplinary case." _Behavioral and Brain Sciences_ 45, e220: 1–59. doi:10.1017/S0140525X2200005X

-Gijsbers, V. (2026) https://youtu.be/ONqLSQVjamA

-Leclercq B. "Le procès des intensions", section 3, chapitre 5, _Introduction à la philosophie analytique, la logique comme méthode (Deuxième édition)_.

