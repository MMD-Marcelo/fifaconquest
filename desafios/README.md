Adicione ou edite os desafios no arquivo do idioma desejado:

- `pt.js`: portugues
- `en.js`: ingles
- `es.js`: espanhol
- `it.js`: italiano
- `fr.js`: frances

Cada desafio deve ter este formato:

```js
{ name: 'Nome do desafio', text: 'Texto do objetivo.' }
```

Na tela inicial, clique em "DESAFIO" e depois em "Sortear" para entregar um desafio para cada jogador.
O jogo usa o idioma selecionado na tela inicial. Se um idioma nao tiver cartas cadastradas, usa `pt.js` como fallback.

`desafios.js` e apenas o registro base. Normalmente voce nao precisa editar esse arquivo.
