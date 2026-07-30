// Auxiliares de escrita no Firestore.

/**
 * Remove chaves com valor `undefined` antes de gravar.
 *
 * O Firestore aceita `null` mas recusa `undefined` com
 * "Unsupported field value: undefined", e o erro sai apontando o campo, nao a
 * origem - o que torna o rastreio demorado.
 *
 * A armadilha e facil de cair montando objeto a partir de documento lido:
 *
 *     metrics: data.metrics ? {...} : undefined   // cria a chave!
 *
 * Isso nao e o mesmo que omitir a chave. Ao espalhar o objeto num update(), a
 * chave viaja com undefined e a escrita inteira falha. O certo e o spread
 * condicional (`...(cond ? { metrics } : {})`), e esta funcao serve de rede
 * para os casos que passarem.
 *
 * Atua num nivel so: `undefined` aninhado dentro de mapa e raro aqui e
 * limpar em profundidade custaria clonar tudo a cada gravacao.
 */
export function stripUndefined<T extends Record<string, unknown>>(data: T): Partial<T> {
    const clean: Record<string, unknown> = {};
    Object.keys(data).forEach(key => {
        if (data[key] !== undefined) clean[key] = data[key];
    });
    return clean as Partial<T>;
}
