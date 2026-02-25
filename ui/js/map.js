export const MAP_CONFIG = `
// NOTE: This legend is for human reference only. Source of truth for building data is buildings.js
[Buildings]
H: Town Hall (orchestrator)
L: Grand Archive (researcher)
B: Cozy Barn (idle, complete, error)
F: Steam Forge (generic)
C: Cog Factory (worker)
I: Inspector's Tower (reviewer)
W: The Scriptorium (writer)
S: Apothecary (decorative)
M: Market (decorative)

[Terrain]
. grass  # path  : cobblestone  + plaza  % stone wall
~ water  P pond  = bridge  A farm  K fountain (2×2)

[Decorations]
T pine  O oak  * bush  R rock  l lamp  p pipes  G gear

[Map]
TTT.T.OOOTTT..TT.TTTT.TTTT.TT.TTTT.O~~~.TTTT..TT..TTTT.TT..T
TOTT*TTT.T.T...TT.T.TTT.TTTTTTO.....~~~..TTT.T.TT.O.TTTTO.T.
..T............*..T..O..............~~~..................T.T
.O........O.T....O..R...........T.O.~~~.....................
TT..................................~~~.O.................TT
T...:::::l.....T....T..l::::..O.....~~~...................*.
..T.::L:::::::::::::::::::H:::::::::===::########.....l.....
....:::::.*O.T.T....O.....:....O..l:~~~:%%%%%%%######I....T.
T*..:::::..R...*..l+++++++++++++l..:~~~:::::pp%*..........*.
.....l:############++++++KK+++++...:~~~::F::pp%.......O...TT
######:............+++++++++++++O..:~~~:::::pp%.....O......T
......:............+++++++++++++...:~~~:::::pp%.T.........T.
.*...R:......OT...l+++M+++++++S+l..:~~~:::::pp%*..O...*....T
T.....:.....TOOT..O******l:l****O..:~~~:::::pp%.....*.......
.O....:......OO.....R.....:........:~~~:::::pp%.........O...
T..R..:.............T....*:*....O..:~~~:::::pp%...........TT
......:l::W::..l...l*..l..:.l.....l:~~~:::::pp%...*.......OT
.T....::::::::::::::::::::::::::::::===:::::pp%.....O..*....
..O......#..T.......T.#.:.......O..O~~~:::::pp%*..........T.
T.......#.O.T..R....*.#l:AAAAAAAAAAA~~~:::::pp%....R...*....
.*....OPPP..O.......AAAA:AAAAAAAAAAA~~~::C::pp%..O..........
T.....PPPPP.O..*....AAAA:##AAAAAAAAA~~~%%%%%%%%*..........TT
..O..TPPPPPP........AAAA::BAAAAAAAAA~~~....................T
.T*OOOPPPPPPTTTT.TTTAAAAAAAAAAAAAAAA~~~T.TTT.TTT.TT.T.TT..T.
T.TOOTT.T..T.T.TTTT.T*TT.TT.O.T.T.T.~~~TT...TT.TTT..T..T.TOT
`;
