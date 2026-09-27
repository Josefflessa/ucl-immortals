import type { Player } from './gameData';

/**
 * Seleção de jogadores de elencos atuais e históricos de clubes do Brasileirão.
 * Cada ID foi conferido no elenco do SortitoutSI e o retrato correspondente é
 * baixado para client/public/players/sortitoutsi antes de expor a carta.
 *
 * Clubes consultados:
 * https://sortitoutsi.net/football-manager/team/337/sao-paulo-futebol-clube
 * https://sortitoutsi.net/football-manager-2026/competition/102423/brazilian-national-first-division
 */

type Entry = readonly [name: string, position: Player['position'], club: string, faceId: number];

const entries: Entry[] = [
  // Ceará
  ['Michel Macedo', 'RB', 'Ceará', 19019226], ['Dentinho', 'CAM', 'Ceará', 19028920],
  ['Fernando Sobral', 'CDM', 'Ceará', 19249856], ['Stiven Mendoza', 'CAM', 'Ceará', 76016258],
  // Vasco
  ['Tchê Tchê', 'CDM', 'Vasco', 19250321], ['Riquelme', 'LB', 'Vasco', 223637],
  ['Marino Hinestroza', 'CAM', 'Vasco', 76057670], ['Matheus França', 'CAM', 'Vasco', 2000090823],
  ['Robert Renan', 'CB', 'Vasco', 2000136297], ['Adson', 'CAM', 'Vasco', 19380038],
  ['Juan Sforza', 'CDM', 'Vasco', 14204638],
  // Atlético Mineiro
  ['Eduardo Vargas', 'CAM', 'Atlético Mineiro', 75003107], ['Ignacio Fernández', 'CAM', 'Atlético Mineiro', 14031117],
  ['Rodrigo Caio', 'CB', 'São Paulo', 19156536], ['Tomás Pérez', 'CDM', 'Atlético Mineiro', 2000166169],
  ['Róger Guedes', 'CAM', 'Atlético Mineiro', 19192947], ['Sávio', 'CAM', 'Atlético Mineiro', 2000011972],
  ['Keno', 'CAM', 'Atlético Mineiro', 19219855],
  // Cruzeiro
  ['Sídnei', 'CB', 'Cruzeiro', 8832967], ['Waguininho', 'CAM', 'Cruzeiro', 19189170],
  ['Robinho', 'CAM', 'Cruzeiro', 19030226], ['Federico Mancuello', 'CAM', 'Cruzeiro', 14022096],
  // Juventude
  ['Mauro Zárate', 'CAM', 'Juventude', 961289], ['Ricardo Bueno', 'ST', 'Juventude', 19003288],
  ['William Matheus', 'LB', 'Juventude', 19061779], ['Yuri Mamute', 'CAM', 'Juventude', 19162727],
  ['Vitor Gabriel', 'ST', 'Juventude', 19348887], ['Danilo Boza', 'CB', 'Juventude', 19354991],
  // Vitória
  ['Jádson', 'CAM', 'Vitória', 320362], ['Santiago Tréllez', 'ST', 'Vitória', 76003749],
  ['Roberto', 'CAM', 'Vitória', 319220], ['Willian Farias', 'CDM', 'Vitória', 19030967],
  ['Caíque Gonçalves', 'CDM', 'Vitória', 19270810], ['Wellington Rato', 'CAM', 'Vitória', 19335470],
  ['Denílson', 'CAM', 'Vitória', 19202678],
  // Fluminense
  ['Germán Cano', 'ST', 'Fluminense', 14003037], ['David Braz', 'CB', 'Fluminense', 2111732],
  ['André', 'CDM', 'Fluminense', 19375640], ['Luiz Henrique', 'CAM', 'Fluminense', 19377206],
  ['Junior Sornoza', 'CAM', 'Fluminense', 86029992], ['Nino', 'CB', 'Fluminense', 19261503],
  ['John Kennedy', 'ST', 'Fluminense', 19400559],
  // Fortaleza
  ['Titi', 'CB', 'Fortaleza', 19015213], ['Fernando Miguel', 'GK', 'Fortaleza', 8833560],
  ['Calebe', 'CAM', 'Fortaleza', 19363221], ['Valentín Depietri', 'CAM', 'Fortaleza', 14243533],
  ['Benjamín Kuscevic', 'CB', 'Fortaleza', 75032824], ['Gabriel Souza', 'CAM', 'Fortaleza', 2000218959],
  ['Ryan', 'CDM', 'Fortaleza', 2000161825], ['Imanol Machuca', 'CAM', 'Fortaleza', 14223283],
  ['Yeison Guzmán', 'CAM', 'Fortaleza', 76047118],
  // Grêmio
  ['Geromel', 'CB', 'Grêmio', 8878850], ['Thiago Santos', 'CDM', 'Grêmio', 19249773],
  ['Luan', 'CAM', 'Grêmio', 19226636], ['Marcelo Grohe', 'GK', 'Grêmio', 8835156],
  ['Miller Bolaños', 'CAM', 'Grêmio', 80007070], ['Viery', 'CB', 'Grêmio', 2000255823],
  ['Alexander Aravena', 'CAM', 'Grêmio', 75055397], ['Luis Eduardo', 'CB', 'Grêmio', 2000440037],
  ['Tiago', 'CAM', 'Grêmio', 2000440048], ['Matías Arezo', 'ST', 'Grêmio', 78094563],
  // Mirassol
  ['Camilo', 'CAM', 'Mirassol', 19002901], ['Ednei', 'CB', 'Mirassol', 19172326],
  ['Darley', 'GK', 'Mirassol', 19013948], ['José Aldo', 'CDM', 'Mirassol', 19271927],
  ['Lucas Oliveira', 'CB', 'Mirassol', 19367739], ['Renato Marques', 'ST', 'Mirassol', 2000109747],
  ['Shaylon', 'CAM', 'Mirassol', 19245683], ['Gabriel Pires', 'CDM', 'Mirassol', 19153477],
  ['Victor Luís', 'LB', 'Mirassol', 55060173],
  // Red Bull Bragantino
  ['Praxedes', 'CAM', 'Bragantino', 19406070], ['Natan', 'CB', 'Bragantino', 19351985],
  ['Helinho', 'CAM', 'Bragantino', 19302916], ['Gustavo Neves', 'CAM', 'Bragantino', 2000157429],
  ['Alerrandro', 'ST', 'Bragantino', 19296892], ['Fabinho', 'CDM', 'Bragantino', 19377986],
  ['José María Herrera', 'CAM', 'Bragantino', 2000051680],
  // Santos
  ['Carlos Sánchez', 'CAM', 'Santos', 8829831], ['Camacho', 'CDM', 'Santos', 19010988],
  ['Maicon Roque', 'CB', 'Santos', 19017908], ['Marcos Leonardo', 'ST', 'Santos', 19380666],
  ['Robinho Junior', 'CAM', 'Santos', 2000417769], ['Gabriel Bontempo', 'CAM', 'Santos', 2000206863],
  ['JP Chermont', 'RB', 'Santos', 2000218555], ['Sandry', 'CM', 'Santos', 19368081],
  ['Gabriel Pirani', 'CM', 'Santos', 19409770],
  // São Paulo
  ['Diego Souza', 'CAM', 'São Paulo', 8830373], ['Petros', 'CDM', 'São Paulo', 19140048],
  ['Miranda', 'CB', 'São Paulo', 8832812],
  ['Tiago Volpi', 'GK', 'São Paulo', 19054347], ['Emiliano Rigoni', 'CAM', 'São Paulo', 14046838],
  ['Éder', 'CAM', 'São Paulo', 2105181],
  ['Rafinha', 'RB', 'São Paulo', 8833533], ['Nikão', 'CAM', 'São Paulo', 19047094],
  ['Igor Gomes', 'CAM', 'São Paulo', 19290872],
  ['Alisson', 'CAM', 'São Paulo', 19189685], ['Patrick', 'CDM', 'São Paulo', 19194171],
  ['Reinaldo', 'LB', 'São Paulo', 19162646], ['Welington', 'LB', 'São Paulo', 19363237],
  ['Pablo Maia', 'CDM', 'São Paulo', 19375656],
  // Palmeiras
  ['Gabriel Veron', 'CAM', 'Palmeiras', 19360962], ['Raphael Veiga', 'CAM', 'Palmeiras', 19233491],
  ['Miguel Borja', 'ST', 'Palmeiras', 76033093], ['Lucas Lima', 'CAM', 'Palmeiras', 19187884],
  ['Patrick de Paula', 'CDM', 'Palmeiras', 19335628],
  ['Weverton', 'GK', 'Palmeiras', 19034819], ['Dudu', 'CAM', 'Palmeiras', 19058671],
  ['Rony', 'CAM', 'Palmeiras', 19249790],
  ['Danilo', 'CDM', 'Palmeiras', 19371902], ['Marcos Rocha', 'RB', 'Palmeiras', 19014340],
  ['Zé Rafael', 'CAM', 'Palmeiras', 19171250],
  ['Jorge', 'LB', 'Palmeiras', 19226738], ['Mayke', 'RB', 'Palmeiras', 19152912],
  ['Jaílson', 'CB', 'Palmeiras', 19256906], ['Gabriel Menino', 'CDM', 'Palmeiras', 19333767],
  ['Deyverson', 'ST', 'Palmeiras', 55062112], ['Eduard Atuesta', 'CDM', 'Palmeiras', 76047499],
  ['Marcelo Lomba', 'GK', 'Palmeiras', 315180], ['Breno Lopes', 'CAM', 'Palmeiras', 19271622],
  ['Rafael Navarro', 'ST', 'Palmeiras', 19381900],
  // Corinthians
  ['Renato Augusto', 'CDM', 'Corinthians', 320569], ['Gil', 'CB', 'Corinthians', 19053424],
  ['Jô', 'ST', 'Corinthians', 8826161], ['Gabriel Pereira', 'CAM', 'Corinthians', 19408820],
  ['Rodriguinho', 'CAM', 'Corinthians', 19074937], ['Fabián Balbuena', 'CB', 'Corinthians', 79013838],
  // Sport
  ['Rithely', 'CDM', 'Sport', 19109926], ['Leandro Pereira', 'ST', 'Sport', 19220896],
  ['Marlone', 'CAM', 'Sport', 19151236], ['Everton Felipe', 'CAM', 'Sport', 19218935],
  ['Rogério', 'CAM', 'Sport', 19086275], ['Ronaldo Alves', 'CB', 'Sport', 19032955],
  ['Samuel Xavier', 'RB', 'Sport', 19100038],
  // Internacional
  ['Edenílson', 'CDM', 'Internacional', 19090354], ['Víctor Cuesta', 'CB', 'Internacional', 14019892],
  ['Peglow', 'CAM', 'Internacional', 19364342], ['Bruno Gomes', 'CDM', 'Internacional', 19376884],
  ['Gustavo Prado', 'CAM', 'Internacional', 2000125272], ['Wesley Moraes', 'ST', 'Internacional', 63028929],
  ['Carlos Palacios', 'CAM', 'Internacional', 75049645], ['Caio Vidal', 'CAM', 'Internacional', 19390669],
  // Botafogo
  ['Nathan Fernandes', 'CAM', 'Botafogo', 2000086446], ['Matheus Nascimento', 'ST', 'Botafogo', 19404650],
  ['Gatito Fernández', 'GK', 'Botafogo', 79000983], ['Mateo Ponte', 'RB', 'Botafogo', 2000076467],
  ['Chay', 'LW', 'Botafogo', 23136061], ['Barreto', 'CDM', 'Botafogo', 19216900],
  ['Klaus', 'CB', 'Botafogo', 19269921], ['Diego Loureiro', 'GK', 'Botafogo', 19270484],
  ['Daniel Borges', 'RB', 'Botafogo', 19171782], ['Jonathan Silva', 'LB', 'Botafogo', 19350832],
  ['Diego Gonçalves', 'CAM', 'Botafogo', 55069803], ['Philipe Sampaio', 'CB', 'Botafogo', 19219729],
  ['Douglas Borges', 'GK', 'Botafogo', 19088878], ['Breno', 'RB', 'Botafogo', 19382052],
  ['Joel Carli', 'CB', 'Botafogo', 14003598], ['Rodrigo Pimpão', 'ST', 'Botafogo', 19061502],
  ['Rodrigo Lindoso', 'CDM', 'Botafogo', 19054614], ['Leo Valencia', 'CAM', 'Botafogo', 75015318],
  ['Luís Ricardo', 'RB', 'Botafogo', 320979],
  // Bahia
  ['Rodrigo Nestor', 'CAM', 'Bahia', 19306946], ['Kanu', 'CB', 'Bahia', 19307359],
  ['Ruan Pablo', 'CAM', 'Bahia', 2000382044], ['Cristian Olivera', 'CAM', 'Bahia', 78097898],
  // Flamengo
  ['João Gomes', 'CDM', 'Flamengo', 19371031], ['Diego', 'CAM', 'Flamengo', 311148],
  // Ceará (lote grande)
  ['Matheus Araújo', 'CAM', 'Ceará', 19390539], ['Rafael Ramos', 'RB', 'Ceará', 55070266],
  ['Matheusinho', 'CAM', 'Ceará', 19284049], ['Wendel Silva', 'ST', 'Ceará', 19350600],
  ['Alex Silva', 'RB', 'Ceará', 19227020], ['Bruno Ferreira', 'GK', 'Ceará', 19174987],
  ['Lucca', 'CAM', 'Ceará', 2000088465], ['Sanchez', 'LB', 'Ceará', 19222422],
  // Vasco (lote grande)
  ['Brenner', 'CAM', 'Vasco', 19302917], ['Jair', 'CDM', 'Vasco', 19190120],
  ['Hugo Moura', 'CDM', 'Vasco', 19270228], ['David', 'CAM', 'Vasco', 19249510],
  ['Johan Rojas', 'CAM', 'Vasco', 2000159964], ['JP Murilo', 'CAM', 'Vasco', 2000218977],
  ['Daniel Fuzato', 'GK', 'Vasco', 19220270],
  // Atlético Mineiro (lote grande)
  ['Maycon', 'CDM', 'Atlético Mineiro', 19221567], ['Natanael', 'RB', 'Atlético Mineiro', 19383253],
  ['Vitor Hugo', 'CB', 'Atlético Mineiro', 19144097], ['Ruan Tressoldi', 'CB', 'Atlético Mineiro', 19352206],
  ['Iván Román', 'CB', 'Atlético Mineiro', 2000230119], ['Alan Minda', 'CAM', 'Atlético Mineiro', 2000048774],
  // Flamengo (lote grande)
  ['Erick Pulgar', 'CDM', 'Flamengo', 75030706], ['Ayrton Lucas', 'LB', 'Flamengo', 19284037],
  ['Everton Cebolinha', 'CAM', 'Flamengo', 19233146], ['Guillermo Varela', 'RB', 'Flamengo', 78044524],
  // Cruzeiro (lote grande)
  ['Wanderson', 'CAM', 'Cruzeiro', 18073840], ['Lucas Silva', 'CDM', 'Cruzeiro', 19152917],
  ['Kaiki', 'LB', 'Cruzeiro', 2000086175], ['Walace', 'CDM', 'Cruzeiro', 19184263],
  ['Matheus Cunha', 'GK', 'Cruzeiro', 19347269], ['Bruno Rodrigues', 'CAM', 'Cruzeiro', 19280849],
  ['Chico da Costa', 'ST', 'Cruzeiro', 51069231], ['Fágner', 'RB', 'Cruzeiro', 19023829],
  // Bahia (lote grande)
  ['Gabriel Xavier', 'CB', 'Bahia', 83335593], ['Nicolás Acevedo', 'CDM', 'Bahia', 78094472],
  ['David Duarte', 'CB', 'Bahia', 19273581], ['Michel Araújo', 'CAM', 'Bahia', 78082187],
  ['Iago Borduchi', 'LB', 'Bahia', 19287778],
  // Juventude (lote grande)
  ['Rodrigo Sam', 'CB', 'Juventude', 19250588], ['Alan Ruschel', 'LB', 'Juventude', 19052745],
  ['Manuel Castro', 'CAM', 'Juventude', 78064929], ['Émerson Galego', 'CAM', 'Juventude', 2000278091],
  // Vitória (lote grande)
  ['Riccieli', 'CB', 'Vitória', 19362992], ['Osvaldo', 'CAM', 'Vitória', 19019038],
  ['Luan Cândido', 'CB', 'Vitória', 19340771], ['Camutanga', 'CB', 'Vitória', 19190175],
  ['Renzo López', 'ST', 'Vitória', 78048433],
  // Fluminense (lote grande)
  ['Ignacio', 'CB', 'Fluminense', 19357955], ['Otávio', 'CDM', 'Fluminense', 19226437],
  ['Renê', 'LB', 'Fluminense', 19174999], ['Guga', 'RB', 'Fluminense', 19266494],
  ['Santiago Moreno', 'CAM', 'Fluminense', 76062954], ['Nonato', 'CAM', 'Fluminense', 19263853],
  ['Igor Rabello', 'CB', 'Fluminense', 19193798], ['David Terans', 'CAM', 'Fluminense', 78064511],
  // Fortaleza (lote grande)
  ['Brenno', 'GK', 'Fortaleza', 19352200], ['Diogo Barbosa', 'LB', 'Fortaleza', 19144893],
  ['Lucas Gazal', 'CB', 'Fortaleza', 19351380], ['Pierre', 'CDM', 'Fortaleza', 19372220],
  ['Tobias Figueiredo', 'CB', 'Fortaleza', 55022465],
  // Grêmio (lote grande)
  ['Cristian Pavón', 'CAM', 'Grêmio', 14083972], ['Wagner Leonardo', 'CB', 'Grêmio', 19348577],
  ['Felipe Carballo', 'CDM', 'Grêmio', 78074391], ['Dodi', 'CDM', 'Grêmio', 19212066],
  ['Caio Paulista', 'LB', 'Grêmio', 19261679], ['Walter Kannemann', 'CB', 'Grêmio', 14023376],
  ['José Enamorado', 'CAM', 'Grêmio', 76050433],
  // Mirassol (lote grande)
  ['João Victor', 'CB', 'Mirassol', 19351947], ['Rodrigues', 'CB', 'Mirassol', 19261651],
  ['Igor Cariús', 'RB', 'Mirassol', 19278016], ['Lucas Mugni', 'CDM', 'Mirassol', 14023268],
  ['André Luís', 'CAM', 'Mirassol', 19258902],
  ['Chico Kim', 'CAM', 'Mirassol', 19119371], ['Igor Formiga', 'RB', 'Mirassol', 19355315],
  ['Carlos Eduardo', 'CAM', 'Mirassol', 19220698], ['Alex Muralha', 'GK', 'Mirassol', 19172116],
  // Bragantino (lote grande)
  ['José Hurtado', 'RB', 'Bragantino', 86078361], ['Lucas Barbosa', 'CAM', 'Bragantino', 19409769],
  ["Agustín Sant'Anna", 'RB', 'Bragantino', 78079054],
  // Santos (lote grande)
  ['Lautaro Díaz', 'CAM', 'Santos', 14221703], ['João Schmidt', 'CDM', 'Santos', 19102937],
  ['Luan Peres', 'CB', 'Santos', 19215476], ['Thaciano', 'CAM', 'Santos', 19246772],
  ['Zé Ivaldo', 'CB', 'Santos', 19232616], ['Tomás Rincón', 'CDM', 'Santos', 86000589],
  ['Moisés', 'CAM', 'Santos', 19383039], ['Christian Oliva', 'CDM', 'Santos', 78091915],
  ['Gonzalo Escobar', 'LB', 'Santos', 14172026], ['Miguel Terceros', 'CAM', 'Santos', 2000088460],
  // Corinthians (lote grande)
  ['Matheus Bidu', 'LB', 'Corinthians', 19388106], ['Allan', 'CDM', 'Corinthians', 19260884],
  ['Jesse Lingard', 'CAM', 'Corinthians', 28047560], ['André Ramalho', 'CB', 'Corinthians', 16097159],
  ['Fabrizio Angileri', 'LB', 'Corinthians', 14079839], ['Pedro Raul', 'ST', 'Corinthians', 83212491],
  ['Hugo', 'LB', 'Corinthians', 19305767], ['Alex Santana', 'CDM', 'Corinthians', 19167419],
  ['Charles', 'CDM', 'Corinthians', 19305263],
  // Sport (lote grande)
  ['Gustavo Coutinho', 'ST', 'Sport', 83219468], ['Ramon', 'CB', 'Sport', 19259411],
  ['Halls', 'GK', 'Sport', 19404758], ['Dênis', 'GK', 'Sport', 19003589],
  ['Marlon Douglas', 'CAM', 'Sport', 19382495], ['Zé Gabriel', 'CB', 'Sport', 19306936],
  // Internacional (lote grande)
  ['Félix Torres', 'CB', 'Internacional', 86057914], ['Juninho', 'CB', 'Internacional', 19233485],
  ['Rodrigo Villagra', 'CDM', 'Internacional', 14223258], ['Clayton Sampaio', 'CB', 'Internacional', 19306931],
  ['Matheus Bahia', 'LB', 'Internacional', 19293344], ['Kayky', 'CAM', 'Internacional', 19408255],
  // Botafogo (lote grande)
  ['Chris Ramos', 'CAM', 'Botafogo', 67264011], ['Marçal', 'LB', 'Botafogo', 19051992],
  ['Léo Linck', 'GK', 'Botafogo', 19337932],
  // São Paulo (historico)
  ['Daniel Alves', 'RB', 'São Paulo', 315542], ['Hernanes', 'CDM', 'São Paulo', 2114781],
  ['Éverton', 'LB', 'São Paulo', 19030993], ['Pablo', 'CAM', 'São Paulo', 19164366],
  ['Alexandre Pato', 'CAM', 'São Paulo', 2111393], ['Juanfran', 'RB', 'São Paulo', 7451701],
  ['Bruno Alves', 'CB', 'São Paulo', 19110275], ['Joao Rojas', 'CAM', 'São Paulo', 80001411],
  ['Anderson Martins', 'CB', 'São Paulo', 2114099], ['Antony', 'CAM', 'São Paulo', 19338230],
  ['Liziero', 'LB', 'São Paulo', 19273275], ['Vitor Bueno', 'CAM', 'São Paulo', 19257876],
  ['Gonzalo Carneiro', 'ST', 'São Paulo', 78078563], ['Maicosuel', 'CAM', 'São Paulo', 2112034],
  ['Paulinho Boia', 'CAM', 'São Paulo', 19290865], ['Lucas Perri', 'GK', 'São Paulo', 19226197],
  ['Léo Natel', 'CAM', 'São Paulo', 83111413], ['Júnior', 'GK', 'São Paulo', 19261062],
  ['Danilo Gomes', 'CAM', 'São Paulo', 19290870], ['Arthur Gazze', 'GK', 'São Paulo', 19306945],
  ['Juan David Martínez', 'CAM', 'São Paulo', 76050957],
  // Palmeiras (historico)
  ['Edu Dracena', 'CB', 'Palmeiras', 301840], ['Jean', 'RB', 'Palmeiras', 2114782],
  ['Matías Viña', 'LB', 'Palmeiras', 78081848], ['Alejandro Guerra', 'CAM', 'Palmeiras', 5300445],
  ['Emerson Santos', 'CB', 'Palmeiras', 19193812], ['Papagaio', 'ST', 'Palmeiras', 19335633],
  ['Iván Angulo', 'CAM', 'Palmeiras', 76049886], ['Alan', 'CAM', 'Palmeiras', 19298224],
  ['Patrick de Lucca', 'CB', 'Palmeiras', 19335632],
  // Botafogo (historico)
  ['Keisuke Honda', 'CAM', 'Botafogo', 788585], ['Diego Cavalieri', 'GK', 'Botafogo', 3300194],
  ['Marcinho', 'RB', 'Botafogo', 19286840], ['Cícero', 'CDM', 'Botafogo', 8833082],
  ['Danilo Barcelos', 'LB', 'Botafogo', 19125412], ['Saulo', 'GK', 'Botafogo', 19244810],
  ['Gabriel Cortez', 'CAM', 'Botafogo', 86034380], ['Leandrinho', 'CDM', 'Botafogo', 19278386],
  ['Bruno Nazário', 'CAM', 'Botafogo', 19173262], ['Guilherme Santos', 'LB', 'Botafogo', 19035148],
  ['Marcos Vinícius', 'CAM', 'Botafogo', 19164176], ['Bochecha', 'CDM', 'Botafogo', 19260917],
  ['Fernandes', 'CDM', 'Botafogo', 19193819], ['Fernando Costanza', 'RB', 'Botafogo', 19262128],
  // Corinthians (historico)
  ['Víctor Cantillo', 'CDM', 'Corinthians', 76036999], ['Mauro Boselli', 'ST', 'Corinthians', 955957],
  ['Ramiro', 'RB', 'Corinthians', 19196788], ['Yony González', 'CAM', 'Corinthians', 76037203],
  ['Pedrinho', 'CAM', 'Corinthians', 19270245], ['Vágner Love', 'CAM', 'Corinthians', 317288],
  ['Mateus Vital', 'CAM', 'Corinthians', 19251417], ['Everaldo', 'CAM', 'Corinthians', 19270910],
  ['Léo Santos', 'CB', 'Corinthians', 19259884], ['Danilo Avelar', 'CB', 'Corinthians', 19123883],
  ['Marllon', 'CB', 'Corinthians', 19138505], ['Sidcley', 'LB', 'Corinthians', 19226439],
  ['Angelo Araos', 'CAM', 'Corinthians', 75041011], ['Bruno Méndez', 'CB', 'Corinthians', 78089395],
  ['Yago Fernando', 'CB', 'Corinthians', 19157361], ['Janderson', 'CAM', 'Corinthians', 19313976],
  ['Matheus Davó', 'ST', 'Corinthians', 19341620],
  // Internacional (historico)
  ['Paolo Guerrero', 'ST', 'Internacional', 5290748], ['Rodrigo Moledo', 'CB', 'Internacional', 19082804],
  ['Rodrigo Dourado', 'CDM', 'Internacional', 19143372], ['Marcos Guilherme', 'CAM', 'Internacional', 19170209],
  ['Thiago Galhardo', 'CAM', 'Internacional', 19120961], ['Damián Musto', 'CDM', 'Internacional', 14001461],
  ['Renzo Saravia', 'RB', 'Internacional', 14046848], ['William Pottker', 'CAM', 'Internacional', 19165097],
  ['Boschilia', 'CAM', 'Internacional', 19202696], ["Andrés D'Alessandro", 'CAM', 'Internacional', 6300473],
  ['Uendel', 'LB', 'Internacional', 19025840], ['Danilo Fernandes', 'GK', 'Internacional', 320556],
  // Vasco (historico)
  ['Leandro Castán', 'CB', 'Vasco', 2111889], ['Fredy Guarín', 'CDM', 'Vasco', 5262184],
  ['Yago Pikachu', 'RB', 'Vasco', 19173877], ['Jordi', 'GK', 'Vasco', 19190112],
  ['Talles Magno', 'CAM', 'Vasco', 19362860], ['Martín Benítez', 'CAM', 'Vasco', 14042938],
  ['Marrony', 'CAM', 'Vasco', 19350830], ['Werley', 'CB', 'Vasco', 19001693],
  ['Rafael Galhardo', 'RB', 'Vasco', 19055091], ['Andrey', 'CDM', 'Vasco', 19250976],
  ['Bruno César', 'LB', 'Vasco', 2114054], ['Ribamar', 'ST', 'Vasco', 19286841],
  ['Marcos Júnior', 'RB', 'Vasco', 19325405], ['Ricardo Graça', 'CB', 'Vasco', 83107071],
  ['Willian Maranhão', 'CDM', 'Vasco', 19369947], ['Fellipe Bastos', 'CDM', 'Vasco', 2107512],
  ['Cláudio Winck', 'RB', 'Vasco', 19159360],
  // Atlético Mineiro (historico)
  ['Juan Cazares', 'CAM', 'Atlético Mineiro', 14031128], ['Rómulo Otero', 'CAM', 'Atlético Mineiro', 86006513],
  ['Ricardo Oliveira', 'ST', 'Atlético Mineiro', 308379],
  ['Victor', 'GK', 'Atlético Mineiro', 317032], ['Réver', 'CB', 'Atlético Mineiro', 2110905],
  ['Gustavo Blanco', 'CDM', 'Atlético Mineiro', 19249500], ['Fábio Santos', 'LB', 'Atlético Mineiro', 8825880],
  ['Hyoran', 'CAM', 'Atlético Mineiro', 19183683], ['Edinho', 'CAM', 'Atlético Mineiro', 19221407],
  ['Leonardo Silva', 'CB', 'Atlético Mineiro', 3300564], ['Patric', 'RB', 'Atlético Mineiro', 316767],
  ['Franco Di Santo', 'CAM', 'Atlético Mineiro', 75000260], ['Ramón Martínez', 'CDM', 'Atlético Mineiro', 79028317],
  ['Zé Welison', 'CDM', 'Atlético Mineiro', 19197120], ['Maidana', 'CB', 'Atlético Mineiro', 19216903],
  ['Mailton', 'RB', 'Atlético Mineiro', 19312829], ['Maicon Bolt', 'CAM', 'Atlético Mineiro', 2114395],
  ['Michael', 'GK', 'Atlético Mineiro', 19171605], ['Clayton', 'CAM', 'Atlético Mineiro', 19173264],
  ['Lucas Hernández', 'LB', 'Atlético Mineiro', 78042065],
  // Cruzeiro (historico)
  ['Dedé', 'CB', 'Cruzeiro', 19096445], ['Fred', 'ST', 'Cruzeiro', 321081],
  ['Léo', 'CB', 'Cruzeiro', 8833576], ['Edílson', 'RB', 'Cruzeiro', 8832806],
  ['Marcelo Moreno', 'ST', 'Cruzeiro', 19000714], ['Ariel Cabral', 'CDM', 'Cruzeiro', 14004997],
  ['Marcelo Hermes', 'LB', 'Cruzeiro', 19252381], ['João Lucas', 'LB', 'Cruzeiro', 19265538],
  ['Roberson', 'CAM', 'Cruzeiro', 19018369], ['Judivan', 'ST', 'Cruzeiro', 19169914],
  ['Arthur Henrique', 'CB', 'Cruzeiro', 19330404],
  // Bahia (historico)
  ['Zeca', 'RB', 'Bahia', 19172382], ['Gregore', 'CDM', 'Bahia', 19338111],
  ['Nino Paraíba', 'RB', 'Bahia', 19058786], ['Douglas Friedrich', 'GK', 'Bahia', 23123355],
  ['Arthur Caike', 'CAM', 'Bahia', 19180530], ['Régis', 'CAM', 'Bahia', 19088676],
  ['Elton', 'CDM', 'Bahia', 19026925], ['Flávio', 'CDM', 'Bahia', 19259414],
  ['Élber', 'CAM', 'Bahia', 19122788], ['Lucas Fonseca', 'CB', 'Bahia', 19187878],
  ['Ernando', 'CB', 'Bahia', 19015607], ['Daniel', 'CAM', 'Bahia', 19259562],
  ['Fernandão', 'ST', 'Bahia', 19045620],
  // Vitória (historico)
  ['Thiago Carleto', 'LB', 'Vitória', 19028050], ['Jean Irmer', 'CDM', 'Vitória', 19249901],
  ['Alisson Farias', 'CAM', 'Vitória', 19231357], ['Martín Rodríguez', 'GK', 'Vitória', 78015085],
  ['Maurício Ramos', 'CB', 'Vitória', 2108886], ['Fernando Neto', 'LB', 'Vitória', 19202414],
  ['Léo Ceará', 'CAM', 'Vitória', 19219772], ['Gérson Magrão', 'CDM', 'Vitória', 320310],
  ['Rafael Carioca', 'LB', 'Vitória', 19202416], ['Jordy Caicedo', 'CAM', 'Vitória', 86045711],
  ['Vico', 'CAM', 'Vitória', 19259603], ['Van', 'RB', 'Vitória', 19388235],
  ['Júnior Viçosa', 'ST', 'Vitória', 19140756],
  // Fluminense (historico)
  ['Hudson', 'RB', 'Fluminense', 19028048], ['Henrique', 'CDM', 'Fluminense', 19008069],
  ['Wellington Silva', 'CAM', 'Fluminense', 19086339], ['Nenê', 'CAM', 'Fluminense', 312059],
  ['Egídio', 'LB', 'Fluminense', 2114744], ['Digão', 'CB', 'Fluminense', 19019288],
  ['Luccas Claro', 'CB', 'Fluminense', 19096976], ['Matheus Ferraz', 'CB', 'Fluminense', 2111792],
  ['Pablo Dyego', 'RB', 'Fluminense', 19194361], ['Marcos Felipe', 'GK', 'Fluminense', 19189746],
  ['Rodolfo', 'GK', 'Fluminense', 19087401], ['Orinho', 'LB', 'Fluminense', 19328566],
  ['Felippe Cardoso', 'CAM', 'Fluminense', 19341470], ['Fernando Pacheco', 'CAM', 'Fluminense', 77051737],
  // Grêmio (historico)
  ['Vanderlei', 'GK', 'Grêmio', 319607], ['Caio Henrique', 'LB', 'Grêmio', 19258927],
  ['Jean Pyerre', 'CAM', 'Grêmio', 19250977], ['Victor Ferraz', 'RB', 'Grêmio', 2114925],
  ['Luis Orejuela', 'RB', 'Grêmio', 76038502], ['Thiago Neves', 'CAM', 'Grêmio', 2107887],
  ['Paulo Miranda', 'CB', 'Grêmio', 19075841], ['Cortez', 'LB', 'Grêmio', 19148958],
  ['Paulo Victor', 'GK', 'Grêmio', 19014205], ['Leonardo Gomes', 'RB', 'Grêmio', 19249923],
  ['Pepê', 'CAM', 'Grêmio', 19340940], ['Marcelo Oliveira', 'CB', 'Grêmio', 19017804],
  ['Darlan Mendes', 'CDM', 'Grêmio', 19250985],
  // Bragantino (historico)
  ['Matheus Jesus', 'CDM', 'Bragantino', 19226744], ['Claudinho', 'CAM', 'Bragantino', 19258928],
  ['Thonny Anderson', 'CAM', 'Bragantino', 19317126], ['Uillian Correia', 'CDM', 'Bragantino', 55065241],
  ['Ytalo', 'CAM', 'Bragantino', 2104676], ['Aderlan', 'RB', 'Bragantino', 19095247],
  ['Morato', 'CAM', 'Bragantino', 19163101], ['Ligger', 'CB', 'Bragantino', 19191194],
  ['Edimar', 'LB', 'Bragantino', 2111963],
  // Santos (historico)
  ['Diego Pituca', 'CDM', 'Santos', 19270774], ['Felipe Aguilar', 'CB', 'Santos', 76022032],
  ['Fernando Uribe', 'ST', 'Santos', 8829170], ['Alison', 'CDM', 'Santos', 19165158],
  ['Luiz Felipe', 'CB', 'Santos', 19221410], ['Felipe Jonatan', 'LB', 'Santos', 19352672],
  ['Pará', 'RB', 'Santos', 2107529], ['Bryan Ruíz', 'CAM', 'Santos', 18003360],
  ['Raniel', 'CAM', 'Santos', 19249916], ['Vladimir', 'GK', 'Santos', 19036708],
  ['Jean Mota', 'LB', 'Santos', 19189285], ['Evandro', 'CAM', 'Santos', 317306],
  ['Daniel Guedes', 'RB', 'Santos', 19171588], ['Madson', 'RB', 'Santos', 19073917],
  // Sport (historico)
  ['Rafael Thyere', 'CB', 'Sport', 19152793], ['Jonatan Gómez', 'CAM', 'Sport', 14011211],
  ['Maílson', 'GK', 'Sport', 19283715], ['Sander', 'LB', 'Sport', 19163332],
  ['Leandro Barcia', 'CAM', 'Sport', 78067723], ['Hernane', 'ST', 'Sport', 19048212],
  ['Marcão', 'CDM', 'Sport', 19265456], ['Jean Patrick', 'RB', 'Sport', 19161573],
  // Flamengo (historico)
  ['Gustavo Cuéllar', 'CDM', 'Flamengo', 76015131], ['Léo Duarte', 'CB', 'Flamengo', 19247744],
  ['Orlando Berrío', 'CAM', 'Flamengo', 76013932], ['Rhodolfo', 'CB', 'Flamengo', 8830345],
  ['Piris da Motta', 'CDM', 'Flamengo', 79011895], ['César', 'GK', 'Flamengo', 19124580],
  ['Henrique Dourado', 'ST', 'Flamengo', 19187562], ['Miguel Trauco', 'LB', 'Flamengo', 77017791],
  ['Juan', 'CB', 'Flamengo', 3301249], ['Thiago', 'GK', 'Flamengo', 19174894],
  ['Thuler', 'CB', 'Flamengo', 19270227],
];

const FOREIGN_NATIONS: Record<string, string> = {
  'Eduardo Vargas': 'Chile', 'Ignacio Fernández': 'Argentina', 'Federico Mancuello': 'Argentina',
  'Mauro Zárate': 'Argentina', 'Santiago Tréllez': 'Colômbia', 'Germán Cano': 'Argentina',
  'Valentín Depietri': 'Argentina', 'Benjamín Kuscevic': 'Chile', 'Miller Bolaños': 'Equador',
  'Alexander Aravena': 'Chile', 'Matías Arezo': 'Uruguai', 'José María Herrera': 'Argentina',
  'Carlos Sánchez': 'Uruguai', 'Miguel Borja': 'Colômbia', 'Fabián Balbuena': 'Paraguai',
  'Víctor Cuesta': 'Argentina', 'Carlos Palacios': 'Chile', 'Gatito Fernández': 'Paraguai',
  'Mateo Ponte': 'Uruguai', 'Cristian Olivera': 'Uruguai', 'Yeison Guzmán': 'Colômbia',
  'Emiliano Rigoni': 'Argentina', 'Éder': 'Itália',
  'Eduard Atuesta': 'Colômbia',
  'Andrés Gómez': 'Equador', 'Nuno Moreira': 'Portugal', 'Claudio Spinelli': 'Argentina',
  'Carlos Cuesta': 'Colômbia', 'José Luis Rodríguez': 'Venezuela', 'Hugo Moura': 'Portugal',
  'Mateo Cassierra': 'Colômbia', 'Ángelo Preciado': 'Equador', 'Junior Alonso': 'Paraguai',
  'Tomás Cuello': 'Argentina', 'Alan Franco': 'Argentina', 'Iván Román': 'Argentina', 'Alan Minda': 'Equador',
  'Giorgian De Arrascaeta': 'Uruguai', 'Saúl': 'Espanha', 'Nicolás de la Cruz': 'Uruguai',
  'Guillermo Varela': 'Uruguai', 'Luis Sinisterra': 'Colômbia', 'Lucas Romero': 'Argentina',
  'Lucas Villalba': 'Argentina', 'Santiago Ramos Mingo': 'Argentina', 'Nicolás Acevedo': 'Uruguai',
  'Emmanuel Martínez': 'Argentina', 'Aitor Cantalapiedra': 'Espanha', 'Renzo López': 'Uruguai',
  'Jefferson Savarino': 'Venezuela', 'Agustín Canobbio': 'Uruguai', 'Kevin Serna': 'Colômbia',
  'Yeferson Soteldo': 'Venezuela', 'Santiago Moreno': 'Colômbia', 'David Terans': 'Uruguai',
  'Tomás Pochettino': 'Argentina', 'Emanuel Brítez': 'Paraguai', 'Tomás Cardona': 'Argentina',
  'Juan Miritello': 'Argentina', 'Tobias Figueiredo': 'Portugal', 'Mathías Villasanti': 'Paraguai',
  'Martin Braithwaite': 'Dinamarca', 'Francis Amuzu': 'Gana', 'Juan Ignacio Nardoni': 'Argentina',
  'Erick Noriega': 'Peru', 'Cristian Pavón': 'Argentina', 'Felipe Carballo': 'Uruguai',
  'Walter Kannemann': 'Argentina', 'José Enamorado': 'Honduras', 'Antonio Galeano': 'Paraguai',
  'Lucas Mugni': 'Argentina', 'Guzmán Rodríguez': 'Uruguai', 'José Hurtado': 'Venezuela',
  'Agustín Sant\'Anna': 'Uruguai', 'Benjamín Rollheiser': 'Argentina', 'Álvaro Barreal': 'Argentina',
  'Adonis Frías': 'Argentina', 'Lautaro Díaz': 'Argentina', 'Tomás Rincón': 'Venezuela',
  'Christian Oliva': 'Uruguai', 'Gonzalo Escobar': 'Paraguai', 'Miguel Terceros': 'Bolívia',
  'Memphis Depay': 'Holanda', 'André Carrillo': 'Peru', 'Jesse Lingard': 'Inglaterra',
  'Fabrizio Angileri': 'Argentina', 'Sérgio Oliveira': 'Portugal', 'Carlos de Pena': 'Uruguai',
  'Sergio Rochet': 'Uruguai', 'Alexandro Bernabei': 'Argentina', 'Alan Rodríguez': 'Uruguai',
  'Braian Aguirre': 'Argentina', 'Gabriel Mercado': 'Argentina', 'Johan Carbonero': 'Colômbia',
  'Félix Torres': 'Equador', 'Rodrigo Villagra': 'Argentina', 'Alexander Barboza': 'Argentina',
  'Nahuel Ferraresi': 'Venezuela', 'Joaquín Correa': 'Argentina', 'Bastos': 'Angola',
  'Chris Ramos': 'Espanha',
  'Juanfran': 'Espanha',
  'Joao Rojas': 'Equador',
  'Juan David Martínez': 'Venezuela',
  'Matías Viña': 'Uruguai',
  'Alejandro Guerra': 'Venezuela',
  'Iván Angulo': 'Colômbia',
  'Keisuke Honda': 'Japão',
  'Víctor Cantillo': 'Colômbia',
  'Mauro Boselli': 'Argentina',
  'Yony González': 'Colômbia',
  'Angelo Araos': 'Chile',
  'Bruno Méndez': 'Uruguai',
  'Paolo Guerrero': 'Peru',
  'Damián Musto': 'Argentina',
  'Renzo Saravia': 'Argentina',
  "Andrés D'Alessandro": 'Argentina',
  'Fredy Guarín': 'Colômbia',
  'Martín Benítez': 'Argentina',
  'Juan Cazares': 'Equador',
  'Rómulo Otero': 'Venezuela',
  'Franco Di Santo': 'Argentina',
  'Ramón Martínez': 'Venezuela',
  'Lucas Hernández': 'Chile',
  'Martín Rodríguez': 'Uruguai',
  'Jordy Caicedo': 'Equador',
  'Bryan Ruíz': 'Costa Rica',
  'Luis Orejuela': 'Equador',
  'Jonatan Gómez': 'Colômbia',
  'Gustavo Cuéllar': 'Colômbia',
  'Orlando Berrío': 'Colômbia',
  'Piris da Motta': 'Paraguai',
  'Miguel Trauco': 'Peru',
};

const ELITE_NAMES = new Set([
  'Germán Cano', 'Geromel', 'Luan', 'Marcelo Grohe', 'Diego Souza', 'Raphael Veiga',
  'Miguel Borja', 'Renato Augusto', 'Jô', 'Mauro Zárate', 'Eduardo Vargas', 'Ignacio Fernández',
  'Carlos Sánchez', 'Gustavo Scarpa', 'Marcos Leonardo', 'Miranda',
  'Weverton', 'Gustavo Gómez', 'Dudu',
]);

const YOUNG_NAMES = new Set([
  'Tomás Pérez', 'Riquelme', 'Robert Renan', 'Gabriel Souza', 'Ryan', 'Viery', 'Luis Eduardo',
  'Tiago', 'Renato Marques', 'Gustavo Neves', 'José María Herrera', 'Robinho Junior',
  'Gabriel Bontempo', 'JP Chermont', 'Ruan Pablo', 'Nathan Fernandes', 'Mateo Ponte',
]);

function slug(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function overallFor(name: string): number {
  if (ELITE_NAMES.has(name)) return 84;
  if (YOUNG_NAMES.has(name)) return 75;
  return 79;
}

function rarityForOverall(overall: number): Exclude<Player['rarity'], 'unique'> {
  if (overall <= 74) return 'bronze';
  if (overall <= 79) return 'silver';
  if (overall <= 87) return 'gold';
  if (overall <= 93) return 'legendary';
  return 'immortal';
}

function clamp(value: number): number {
  return Math.max(1, Math.min(99, Math.round(value)));
}

function variation(name: string, offset: number): number {
  let hash = offset + 17;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) % 11;
  return hash - 5;
}

function makePlayer([name, position, club, faceId]: Entry, index: number): Player {
  const overall = overallFor(name);
  const v = (offset: number) => variation(name, index + offset);
  const group = position === 'GK' ? 'GK' : ['CB', 'LB', 'RB'].includes(position) ? 'DEF' : ['CDM', 'CM', 'CAM'].includes(position) ? 'MID' : 'ATT';
  const profiles = {
    GK: { pace: overall - 16, shooting: 8, passing: overall - 23, dribbling: overall - 35, defending: overall + 1, physical: overall - 7, composure: overall - 2, vision: overall - 17 },
    DEF: { pace: overall - 8, shooting: overall - 45, passing: overall - 13, dribbling: overall - 28, defending: overall + 3, physical: overall + 1, composure: overall - 6, vision: overall - 22 },
    MID: { pace: overall - 7, shooting: overall - 15, passing: overall + 3, dribbling: overall - 3, defending: overall - 16, physical: overall - 5, composure: overall, vision: overall + 1 },
    ATT: { pace: overall + 4, shooting: overall + 2, passing: overall - 10, dribbling: overall + 2, defending: overall - 45, physical: overall - 4, composure: overall - 1, vision: overall - 9 },
  }[group];

  return {
    id: `sortitoutsi_br_league_${slug(name)}_${slug(club)}`,
    shortName: name,
    fullName: name,
    position,
    nation: FOREIGN_NATIONS[name] ?? 'Brasil',
    club,
    season: '2025/26',
    rarity: rarityForOverall(overall),
    overall,
    pace: clamp(profiles.pace + v(1)), shooting: clamp(profiles.shooting + v(2)),
    passing: clamp(profiles.passing + v(3)), dribbling: clamp(profiles.dribbling + v(4)),
    defending: clamp(profiles.defending + v(5)), physical: clamp(profiles.physical + v(6)),
    composure: clamp(profiles.composure + v(7)), vision: clamp(profiles.vision + v(8)),
    traits: [],
    photoUrl: `/players/sortitoutsi/sortitoutsi_${faceId}.webp`,
  };
}

export const SORTITOUTSI_BRAZILIAN_LEAGUE_ADDITIONS: Player[] = entries.map(makePlayer);
