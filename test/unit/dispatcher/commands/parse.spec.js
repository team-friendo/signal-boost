import { expect } from 'chai'
import { describe, it } from 'mocha'
import { commands, parseErrorTypes } from '../../../../app/dispatcher/commands/constants'
import { parseExecutable } from '../../../../app/dispatcher/commands/parse'
import { languages } from '../../../../app/language'
import { defaultLanguage } from '../../../../app/config'
import { messagesIn } from '../../../../app/dispatcher/strings/messages'

describe('parse module', () => {
  const rawPhoneNumber = '+1 (222) 333-4444'
  const e164PhoneNumber = '+12223334444'
  const rawPhoneNumber2 = '+1 (444) 333-2222'
  const e164PhoneNumber2 = '+14443332222'
  const invalidPhoneNumber = '222-333-4444'

  describe('parsing commands', () => {
    describe('when the message does not begin with a command', () => {
      it('returns a command type of NONE', () => {
        const msgs = [
          'fire the missiles',
          'the ADD foo',
          'the ACCEPT',
          'the BAN',
          'the BROADCAST',
          'the DECLINE',
          'the DESTROY',
          'the REMOVE foo',
          'the HELP',
          'the INFO',
          'the INVITE',
          'the HELLO',
          'the GOODBYE',
          'the REQUEST',
          'the HOTLINE ON',
          'the HOTLINE OFF',
          'the VOUCH LEVEL',
          'the VOUCHING ON',
          'the VOUCHING OFF',
          'the VOUCHING ADMIN',

          'the ENGLISH',

          'la AGREGAR foo',
          'la ACEPTAR',
          'la AYUDA',
          'la PROHIBIR',
          'la INFO',
          'la INVITAR',
          'la HOLA',
          'la ADIÓS',
          'la QUITAR',
          'la RECHAZAR',
          'la RENOMBRAR',
          'la LÍNEA DIRECTA',
          'la LÍNEA DIRECTA',
          'la SOLICITAR',
          'la NIVEL DE ATESTIGUAR',
          'la ATESTIGUANDO ACTIVADA',
          'la ATESTIGUANDO DESACTIVADA',
          'la ATESTIGUANDO ADMIN',
          'la ESPAÑOL',

          'le AJOUTER',
          'le ACCEPTER',
          'le INTERDIRE',
          'le REFUSER',
          'le AIDE',
          'le INFO',
          'le INVITER',
          'le ALLÔ',
          'le ADIEU',
          'le SUPPRIMER',
          'le RENOMMER',
          'le HOTLINE ACTIVÉE',
          'le HOTLINE DÉSACTIVÉE',
          'le DEMANDER',
          'le NIVEAU DE PORTER GARANT',
          'le SE PORTER GARANT ACTIVÉES',
          'le SE PORTER GARANT DÉSACTIVÉES',
          'le SE PORTER GARANT ADMIN',
          'le FRENCH',

          'foo ANNEHMEN',
          'foo HINZUFÜGEN',
          'foo ABLEHNEN',
          'foo VERNICHTEN',
          'foo HILFE',
          'foo HOTLINE AN',
          'foo HOTLINE AUS',
          'foo EINLADEN',
          'foo HALLO',
          'foo TSCHÜSS',
          'foo ENTFERNEN',
          'foo UMBENENNEN',
          'foo BESCHREIBUNG',
          'foo ANFORDERN',
          'foo VERTRAUENS-LEVEL',
          'foo VERTRAUEN AN',
          'foo VERTRAUEN EIN',
          'foo VERTRAUEN AUS',
          'FOO VERTRAUEN ADMIN',
          'foo DEUTSCH',
        ]
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.NONE,
            language: defaultLanguage,
            payload: '',
          }),
        )
      })
    })

    describe('ACCEPT command', () => {
      it('parses an ACCEPT command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['ACCEPT', ' accept '],
          },
          {
            language: languages.ES,
            messages: ['ACEPTAR', ' aceptar '],
          },
          {
            language: languages.FR,
            messages: ['ACCEPTER', ' accepter '],
          },
          {
            language: languages.DE,
            messages: ['ANNEHMEN', ' annehmen '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.ACCEPT,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('ADD command', () => {
      it('parses an ADD command and payload regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: [`ADD ${e164PhoneNumber}`, ` add ${e164PhoneNumber}`],
          },
          {
            language: languages.ES,
            messages: [`AGREGAR ${e164PhoneNumber}`, ` agregar ${e164PhoneNumber}`],
          },
          {
            language: languages.FR,
            messages: [`AJOUTER ${e164PhoneNumber}`, ` ajouter ${e164PhoneNumber}`],
          },
          {
            language: languages.DE,
            messages: [
              `HINZUFÜGEN ${e164PhoneNumber}`,
              `HINZUFUEGEN ${e164PhoneNumber}`,
              `HINZUFUGEN ${e164PhoneNumber}`,
              `DAZU ${e164PhoneNumber}`,
              ` dazu ${e164PhoneNumber} `,
            ],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.ADD,
              language,
              payload: e164PhoneNumber,
            }),
          ),
        )
      })
    })

    describe('BAN command', () => {
      it('parses an BAN command and payload regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['BAN @1312', ' ban @1312'],
          },
        ]

        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.BAN,
              language,
              payload: {
                messageId: 1312,
                reply: '',
              },
            }),
          ),
        )
      })
    })

    describe('BROADCAST command', () => {
      it('parses a BROADCAST command and payload regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: [
              'BROADCAST hello friendos!',
              ' broadcast hello friendos!',
              '! hello friendos!',
            ],
          },
          {
            language: languages.ES,
            messages: ['TRANSMITIR hello friendos!', ' transmitir hello friendos!'],
          },
          {
            language: languages.FR,
            messages: ['DIFFUSER hello friendos!', ' diffuser hello friendos!'],
          },
          {
            language: languages.DE,
            messages: ['SENDEN hello friendos!', ' senden hello friendos!'],
          },
        ]

        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.BROADCAST,
              language,
              payload: 'hello friendos!',
            }),
          ),
        )
      })
    })

    describe('CHANNEL command', () => {
      it('parses an CHANNEL command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: [
              `CHANNEL ${e164PhoneNumber}, ${e164PhoneNumber2}`,
              ` channel ${e164PhoneNumber}, ${e164PhoneNumber2} `,
            ],
          },
          {
            language: languages.ES,
            messages: [
              `CANAL ${e164PhoneNumber}, ${e164PhoneNumber2}`,
              ` canal ${e164PhoneNumber}, ${e164PhoneNumber2} `,
            ],
          },
          {
            language: languages.FR,
            messages: [
              `CHAINE ${e164PhoneNumber}, ${e164PhoneNumber2}`,
              `CHAÎNE ${e164PhoneNumber}, ${e164PhoneNumber2}`,
              ` chaine ${e164PhoneNumber}, ${e164PhoneNumber2} `,
            ],
          },
          {
            language: languages.DE,
            messages: [
              `KANAL ${e164PhoneNumber}, ${e164PhoneNumber2}`,
              ` kanal ${e164PhoneNumber}, ${e164PhoneNumber2} `,
            ],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.CHANNEL,
              language,
              payload: [e164PhoneNumber, e164PhoneNumber2],
            }),
          ),
        )
      })
    })

    describe('DECLINE command', () => {
      it('parses an DECLINE command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['DECLINE', ' decline '],
          },
          {
            language: languages.ES,
            messages: ['RECHAZAR', ' rechazar '],
          },
          {
            language: languages.FR,
            messages: ['REFUSER', ' refuser '],
          },
          {
            language: languages.DE,
            messages: ['ABLEHNEN', ' ablehnen '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.DECLINE,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('DESTROY command', () => {
      it('parses an DESTROY command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['DESTROY', ' destroy '],
          },
          {
            language: languages.ES,
            messages: ['DESTRUIR', ' destruir '],
          },
          {
            language: languages.FR,
            messages: ['DÉTRUIRE', ' détruire '],
          },
          {
            language: languages.DE,
            messages: ['VERNICHTEN', ' vernichten '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.DESTROY,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('DESTROY_CONFIRM command', () => {
      it('parses an DESTROY_CONFIRM command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['CONFIRM DESTROY', ' confirm destroy '],
          },
          {
            language: languages.ES,
            messages: ['CONFIRMAR DESTRUIR', ' confirmar destruir '],
          },
          {
            language: languages.FR,
            messages: ['CONFIRMER DÉTRUIRE', ' confirmer détruire '],
          },
          {
            language: languages.DE,
            messages: ['BESTÄTIGEN VERNICHTEN', ' bestätigen vernichten '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.DESTROY_CONFIRM,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('HELP command', () => {
      it('parses an HELP command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['HELP', 'help', ' help '],
          },
          {
            language: languages.ES,
            messages: ['AYUDA', 'ayuda', ' ayuda '],
          },
          {
            language: languages.FR,
            messages: ['AIDE', 'aide', ' aide '],
          },
          {
            language: languages.DE,
            messages: ['HILFE', ' hilfe '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.HELP,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('INFO command', () => {
      it('parses an INFO command in EN regardless of language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['INFO', 'info', ' info '],
          },
        ]
        variants.forEach(({ messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.INFO,
              language: languages.EN,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('INVITE command', () => {
      it('parses an INVITE command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: [
              `INVITE ${e164PhoneNumber}, ${e164PhoneNumber2}`,
              ` invite ${e164PhoneNumber}, ${e164PhoneNumber2} `,
            ],
          },
          {
            language: languages.ES,
            messages: [
              `INVITAR ${e164PhoneNumber}, ${e164PhoneNumber2}`,
              ` invitar ${e164PhoneNumber}, ${e164PhoneNumber2} `,
            ],
          },
          {
            language: languages.FR,
            messages: [
              `INVITER ${e164PhoneNumber}, ${e164PhoneNumber2}`,
              ` inviter ${e164PhoneNumber}, ${e164PhoneNumber2} `,
            ],
          },
          {
            language: languages.DE,
            messages: [
              `EINLADEN ${e164PhoneNumber}, ${e164PhoneNumber2}`,
              ` einladen ${e164PhoneNumber}, ${e164PhoneNumber2} `,
            ],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.INVITE,
              language,
              payload: [e164PhoneNumber, e164PhoneNumber2],
            }),
          ),
        )
      })
    })

    describe('JOIN command', () => {
      it('parses an JOIN command from "hello" or "join" (regardless of case or whitespace)', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['HELLO', ' hello ', 'hello.', 'hello!', 'hello!!!', 'JOIN', ' join '],
          },
          {
            language: languages.ES,
            messages: ['HOLA', ' hola '],
          },
          {
            language: languages.FR,
            messages: ['ALLÔ', 'ALLO', ' allo '],
          },
          {
            language: languages.DE,
            messages: ['HALLO', ' hallo '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.JOIN,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('LEAVE command', () => {
      it('parses a LEAVE command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: [
              'GOODBYE',
              'goodbye',
              ' goodbye ',
              'LEAVE',
              'leave',
              '  leave ',
              'STOP',
              ' stop ',
              'UNSUBSCRIBE',
              'unsubscribe  ',
            ],
          },
          {
            language: languages.ES,
            messages: ['ADIÓS', 'adiós', ' adiós ', 'ADIOS', 'adios', '  adios '],
          },
          {
            language: languages.FR,
            messages: ['ADIEU', 'adieu', ' adieu '],
          },
          {
            language: languages.DE,
            messages: ['TSCHÜSS', 'TSCHUESS', 'TSCHÜß', 'TSCHUSS', 'TSCHUß', 'CIAO', ' tschuss '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.LEAVE,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('PRIVATE command', () => {
      it('parses a LEAVE command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['PRIVATE', 'private', ' private ', '~'],
          },
          {
            language: languages.ES,
            messages: ['PRIVADA', 'PRIVADO', ' privada ', ' privado '],
          },
          {
            language: languages.FR,
            messages: ['PRIVÉ', 'PRIVÉE', ' privé ', ' privée '],
          },
          {
            language: languages.DE,
            messages: ['PRIVAT', ' privat '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.PRIVATE,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('REMOVE command', () => {
      it('parses a REMOVE command and payload regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: [`REMOVE ${e164PhoneNumber}`, ` remove ${e164PhoneNumber}`],
          },
          {
            language: languages.ES,
            messages: [`QUITAR ${e164PhoneNumber}`, `quitar ${e164PhoneNumber}`],
          },
          {
            language: languages.FR,
            messages: [`SUPPRIMER ${e164PhoneNumber}`, ` supprimer ${e164PhoneNumber}`],
          },
          {
            language: languages.DE,
            messages: [`ENTFERNEN ${e164PhoneNumber}`, ` entfernen ${e164PhoneNumber} `],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.REMOVE,
              language,
              payload: e164PhoneNumber,
            }),
          ),
        )
      })
    })

    describe('REQUEST command', () => {
      it('parses an REQUEST command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['REQUEST', 'request', ' request '],
          },
          {
            language: languages.ES,
            messages: ['SOLICITAR', 'solicitar', ' solicitar '],
          },
          {
            language: languages.FR,
            messages: ['DEMANDER', 'demander', ' demander '],
          },
          {
            language: languages.DE,
            messages: ['ANFORDERN', 'anfordern ', ' anfordern '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.REQUEST,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('HOTLINE_ON command', () => {
      it('parses a HOTLINE ON command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['HOTLINE ON', 'hotline on', ' hotline on '],
          },
          {
            language: languages.ES,
            messages: [
              'LÍNEA DIRECTA ACTIVADA',
              'línea directa activada',
              ' linea directa activada ',
            ],
          },
          {
            language: languages.FR,
            messages: ['HOTLINE ACTIVÉE', 'hotline activée', ' hotline activee '],
          },
          {
            language: languages.DE,
            messages: ['HOTLINE AN', ' hotline an '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.HOTLINE_ON,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('HOTLINE_OFF command', () => {
      it('parses an HOTLINE_OFF command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['HOTLINE OFF', ' hotline off '],
          },
          {
            language: languages.ES,
            messages: [
              'LÍNEA DIRECTA DESACTIVADA',
              'línea directa desactivada',
              ' Linea directa desactivada ',
            ],
          },
          {
            language: languages.FR,
            messages: ['HOTLINE DÉSACTIVÉE', 'hotline désactivée', ' hotline desactivee '],
          },
          {
            language: languages.DE,
            messages: ['HOTLINE AUS', ' hotline aus '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.HOTLINE_OFF,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('REPLY command', () => {
      it('parses a REPLY command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['REPLY #1312', 'reply #1312 ', '@ #1312', '@1312'],
          },
          {
            language: languages.ES,
            messages: ['RESPONDER #1312', ' responder #1312 '],
          },
          {
            language: languages.FR,
            messages: ['RÉPONDRE #1312', 'REPONDRE #1312', ' repondre #1312 '],
          },
          {
            language: languages.DE,
            messages: ['ANTWORTEN #1312', ' antworten #1312 '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.REPLY,
              language,
              payload: {
                messageId: 1312,
                reply: '',
              },
            }),
          ),
        )
      })
    })

    describe('SET_LANGUAGE command', () => {
      it('sets language regardless of language in which new language is specified', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['ENGLISH', 'INGLÉS', 'INGLES', 'ANGLAIS', 'ENGLISCH', ' english '],
          },
          {
            language: languages.ES,
            messages: ['ESPAÑOL', 'ESPANOL', 'SPANISH', 'SPANISCH', ' spanish '],
          },
          {
            language: languages.FR,
            messages: [
              'FRENCH',
              'FRANÇAIS',
              'FRANCAIS',
              'FRANCESA',
              'FRANZÖSISCH',
              'FRANZOESISCH',
              ' french ',
            ],
          },
          {
            language: languages.DE,
            messages: ['GERMAN', 'DEUTSCH', 'ALLEMAND', 'ALEMAN', 'ALEMÁN', ' german '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.SET_LANGUAGE,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('VOUCHING_ON command', () => {
      it('parses VOUCHING_ON regardless of spacing, accents, casing, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['VOUCHING ON', ' vouching on '],
          },
          {
            language: languages.ES,
            messages: ['ATESTIGUANDO ACTIVADA', ' atestiguando activada '],
          },
          {
            language: languages.FR,
            messages: ['SE PORTER GARANT ACTIVÉE', ' se porter garant activee '],
          },
          {
            language: languages.DE,
            messages: ['VERTRAUEN AN', 'VERTRAUEN EIN', ' vertrauen an '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.VOUCHING_ON,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('VOUCHING_OFF command', () => {
      it('parses VOUCHING_OFF regardless of spacing, accents, casing, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['VOUCHING OFF', ' vouching off '],
          },
          {
            language: languages.ES,
            messages: ['ATESTIGUANDO DESACTIVADA', ' atestiguando desactivada '],
          },
          {
            language: languages.FR,
            messages: ['SE PORTER GARANT DÉSACTIVÉE', ' se porter garant desactivee '],
          },
          {
            language: languages.DE,
            messages: ['VERTRAUEN AUS', ' vertrauen aus '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.VOUCHING_OFF,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('VOUCHING_ADMIN command', () => {
      it('parses VOUCHING_ADMIN regardless of spacing, accents, casing, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['VOUCHING ADMIN', ' vouching admin '],
          },
          {
            language: languages.ES,
            messages: ['ATESTIGUANDO ADMIN', ' atestiguando admin '],
          },
          {
            language: languages.FR,
            messages: ['SE PORTER GARANT ADMIN', ' se porter garant admin '],
          },
          {
            language: languages.DE,
            messages: ['VERTRAUEN ADMIN', ' vertrauen admin '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.VOUCHING_ADMIN,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('VOUCH_LEVEL command', () => {
      const vouchLevel = 3

      it('parses a VOUCH LEVEL regardless of spacing, accents, casing, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: [`VOUCH LEVEL ${vouchLevel}`, ` vouch Level ${vouchLevel}`],
          },
          {
            language: languages.ES,
            messages: [`NIVEL DE ATESTIGUAR ${vouchLevel}`, ` nivel de atestiguar ${vouchLevel}`],
          },
          {
            language: languages.FR,
            messages: [
              `NIVEAU DE PORTER GARANT ${vouchLevel}`,
              ` niveau de porter garant${vouchLevel}`,
            ],
          },
          {
            language: languages.DE,
            messages: [`VERTRAUENS-LEVEL ${vouchLevel}`, ` vertrauens-level ${vouchLevel}`],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.VOUCH_LEVEL,
              language,
              payload: `${vouchLevel}`,
            }),
          ),
        )
      })
    })
  })

  describe('validating payloads', () => {
    describe('a no-payload command followed by a payload', () => {
      it('returns an INVALID PAYLOAD parseError', () => {
        const noPayloadCommands = [
          commands.ACCEPT,
          commands.DECLINE,
          commands.HELP,
          commands.JOIN,
          commands.LEAVE,
          commands.SET_LANGUAGE,
          commands.HOTLINE_ON,
          commands.VOUCHING_ON,
          commands.REQUEST,
        ]

        const variants = [
          {
            language: languages.EN,
            messages: [
              'accept foo',
              'decline foo',
              'help foo',
              'hello foo',
              'goodbye foo',
              'english foo',
              'hotline on foo',
              'vouching on foo',
              'request foo',
            ],
          },
          {
            language: languages.ES,
            messages: [
              'aceptar foo',
              'rechazar foo',
              'ayuda foo',
              'hola foo',
              'adios foo',
              'espanol foo',
              'línea directa activada foo',
              'atestiguando activada foo',
              'solicitar foo',
            ],
          },
          {
            language: languages.FR,
            messages: [
              'accepter foo',
              'refuser foo',
              'aide foo',
              'allo foo',
              'adieu foo',
              'francais foo',
              'hotline activee foo',
              'se porter garant activee foo',
              'demander foo',
            ],
          },
          {
            language: languages.DE,
            messages: [
              'annehmen foo',
              'ablehnen foo',
              'hilfe foo',
              'hallo foo',
              'tschuss foo',
              'deutsch foo',
              'hotline an foo',
              'vertrauen an foo',
              'anfordern foo',
            ],
          },
        ]

        variants.forEach(({ language, messages }) =>
          messages.forEach((msg, index) => {
            expect(parseExecutable(msg)).to.eql({
              command: noPayloadCommands[index],
              payload: '',
              error: messagesIn(language).parseErrors.unnecessaryPayload(msg.slice(0, -4)),
              type: parseErrorTypes.NON_EMPTY_PAYLOAD,
            })
          }),
        )
      })
    })

    describe('a phone number payload', () => {
      describe('when phone number is valid', () => {
        it('returns a command match with e164-formatted number in payload', () => {
          const variants = [
            {
              language: languages.EN,
              messages: [`add ${rawPhoneNumber}`, `remove ${rawPhoneNumber}`],
            },
            {
              language: languages.ES,
              messages: [`agregar ${rawPhoneNumber}`, `quitar ${rawPhoneNumber}`],
            },
            {
              language: languages.FR,
              messages: [`ajouter ${rawPhoneNumber}`, `supprimer ${rawPhoneNumber}`],
            },
            {
              language: languages.DE,
              messages: [`HINZUFÜGEN ${rawPhoneNumber}`, `ENTFERNEN ${rawPhoneNumber}`],
            },
          ]

          variants.forEach(({ messages }) =>
            messages.forEach(msg => {
              expect(parseExecutable(msg).payload).to.eql(e164PhoneNumber)
            }),
          )
        })
      })

      describe('when phone number is invalid', () => {
        it('returns a parse error', () => {
          expect(parseExecutable(`ADD ${invalidPhoneNumber}`)).to.eql({
            command: commands.ADD,
            payload: '',
            error: messagesIn(languages.EN).parseErrors.invalidPhoneNumber(invalidPhoneNumber),
            type: parseErrorTypes.INVALID_PAYLOAD,
          })
        })
      })
    })

    describe('a list of phone numbers payload', () => {
      const variantsOf = phoneNumbers => [
        { language: languages.EN, message: `invite ${phoneNumbers}` },
        { language: languages.ES, message: `invitar ${phoneNumbers}` },
        { language: languages.FR, message: `inviter ${phoneNumbers}` },
        { language: languages.DE, message: `einladen ${phoneNumbers}` },
        { language: languages.EN, message: `channel ${phoneNumbers}` },
        { language: languages.ES, message: `canal ${phoneNumbers}` },
        { language: languages.FR, message: `chaine ${phoneNumbers}` },
        { language: languages.DE, message: `kanal ${phoneNumbers}` },
      ]

      describe('with a single valid phone number', () => {
        it('returns a command match with an array containing one e164 phone number as payload', () => {
          variantsOf(`${rawPhoneNumber}`).forEach(({ message }) =>
            expect(parseExecutable(message).payload).to.eql([e164PhoneNumber]),
          )
        })
      })

      describe('with many valid phone numbers', () => {
        it('returns a command match with an array of e164 phone numbers as payload', () => {
          variantsOf(`${rawPhoneNumber}, ${rawPhoneNumber2}`).forEach(({ message }) =>
            expect(parseExecutable(message).payload).to.eql([e164PhoneNumber, e164PhoneNumber2]),
          )
        })
      })

      describe('with one invalid phone number', () => {
        it('returns a parse error', () => {
          variantsOf(`foo`).forEach(({ message, language }) =>
            expect(parseExecutable(message)).to.include({
              error: messagesIn(language).parseErrors.invalidPhoneNumber('foo'),
              type: parseErrorTypes.INVALID_PAYLOAD,
            }),
          )
        })
      })

      describe('with many invalid phone numbers', () => {
        it('returns a parse error', () => {
          variantsOf(`foo, ${invalidPhoneNumber}`).forEach(({ message, language }) =>
            expect(parseExecutable(message)).to.include({
              error: messagesIn(language).parseErrors.invalidPhoneNumbers([
                'foo',
                invalidPhoneNumber,
              ]),
              type: parseErrorTypes.INVALID_PAYLOAD,
            }),
          )
        })
      })

      describe('with a mix of invalid and valid phone numbers', () => {
        it('returns a parse error', () => {
          variantsOf(`foo, ${rawPhoneNumber}, ${invalidPhoneNumber}, ${rawPhoneNumber2}`).forEach(
            ({ message, language }) =>
              expect(parseExecutable(message)).to.include({
                error: messagesIn(language).parseErrors.invalidPhoneNumbers([
                  'foo',
                  invalidPhoneNumber,
                ]),
                type: parseErrorTypes.INVALID_PAYLOAD,
              }),
          )
        })
      })
    })

    describe('a hotline reply payload', () => {
      describe('when it contains a valid message id', () => {
        const variants = [
          { language: languages.EN, message: 'REPLY #1312 foo' },
          { language: languages.ES, message: 'RESPONDER #1312 foo' },
          { language: languages.FR, message: 'RÉPONDRE #1312 foo' },
          { language: languages.DE, message: 'ANTWORTEN #1312 foo' },
        ]

        it('returns a command match with a HotlineReply as a payload', () => {
          variants.forEach(({ language, message }) =>
            expect(parseExecutable(message)).to.eql({
              command: commands.REPLY,
              language,
              payload: { messageId: 1312, reply: 'foo' },
            }),
          )
        })
      })

      describe('when it does not contain a valid message id', () => {
        const variants = [
          { language: languages.EN, message: 'REPLY #abc foo' },
          { language: languages.ES, message: 'RESPONDER #abc foo' },
          { language: languages.FR, message: 'RÉPONDRE #abc foo' },
          { language: languages.DE, message: 'ANTWORTEN #abc foo' },
        ]
        it('returns a parse error', () => {
          variants.forEach(({ language, message }) =>
            expect(parseExecutable(message)).to.include({
              error: messagesIn(language).parseErrors.invalidHotlineMessageId('#abc foo'),
              type: parseErrorTypes.INVALID_PAYLOAD,
            }),
          )
        })
      })

      describe('a multi-line hotline reply', () => {
        const message = 'reply #2 friendos\n to\n the\n\n rescue!!!!!!'
        it('parses the hotline reply, including line breaks', () => {
          expect(parseExecutable(message).payload).to.eql({
            messageId: 2,
            reply: 'friendos\n to\n the\n\n rescue!!!!!!',
          })
        })
      })
    })

    describe('a ban payload', () => {
      describe('when it contains a valid message id', () => {
        const variants = [
          { language: languages.EN, message: 'BAN #1312' },
          { language: languages.ES, message: 'PROHIBIR #1312' },
          { language: languages.FR, message: 'INTERDIRE #1312' },
          { language: languages.DE, message: 'VERBIETEN #1312' },
        ]

        it('returns a command match with a HotlineReply as a payload', () => {
          variants.forEach(({ language, message }) =>
            expect(parseExecutable(message)).to.eql({
              command: commands.BAN,
              language,
              payload: { messageId: 1312, reply: '' },
            }),
          )
        })
      })

      describe('when it does not contain a valid message id', () => {
        const variants = [
          { language: languages.EN, message: 'BAN #abc foo' },
          { language: languages.ES, message: 'PROHIBIR #abc foo' },
          { language: languages.FR, message: 'INTERDIRE #abc foo' },
          { language: languages.DE, message: 'VERBIETEN #abc foo' },
        ]
        it('returns a parse error', () => {
          variants.forEach(({ language, message }) =>
            expect(parseExecutable(message)).to.include({
              error: messagesIn(language).parseErrors.invalidHotlineMessageId('#abc foo'),
              type: parseErrorTypes.INVALID_PAYLOAD,
            }),
          )
        })
      })
    })
  })
})
