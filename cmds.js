const {models} = require('./model');
const {log,biglog,errorlog,colorize} = require("./out");
const Sequelize = require('sequelize');

/**
 * Muestra la ayuda
 */

exports.helpCmd = (socket,rl) =>{
    log(socket,"Comandos: ");
    log(socket,"  h|help - Muestra esta ayuda.");
    log(socket,"  list - Listar los quizzes existentes.");
    log(socket,"  show<id> - Muestra la pregunta y la respuest el quiz indicado.");
    log(socket,"  add - Añadir un nuevo quiz interactivamente.");
    log(socket,"  delete<id> - Borrar el quiz inidcado.");
    log(socket,"  edit<id> - Editar el quiz indicado.");
    log(socket,"  test<id> - Probar el quiz indicado.");
    log(socket,"  p|play - Jugar a preguntar aleatoriamente todos los quizzes.");
    log(socket,"  credits - Creditos.");
    log(socket,"  q|quit - Salir del programa.");
    rl.prompt();
};

/**
 * Lista todos los comandos existentes en el modelos.
 */

exports.listCmd = (socket,rl )=>{
    models.quiz.findAll()
        .each(quiz => {
            log(socket,` [${colorize(quiz.id, 'magenta')}]: ${quiz.question}`);
        })
        .catch(error =>{
            errorlog(socket,error.message);
        })
        .then(()=>{
            rl.prompt();
        });
};


const validateId = id  => {
    return new Sequelize.Promise((resolve, reject) => {
        if(typeof id === "undefined"){
            reject (new Error (`Falta el parámetro <id>.`));
        }else{
            id = parseInt(id);
            if(Number.isNaN(id)){
                reject (new Error (`El valor del parámetro <id> no es un número.`));
            }else{
                resolve(id);
            }
        }
    });
};


/**
 * Muestra el quiz indicado en el parámetro: la pregunta y la respuesta
 *
 * @param id Clave del quiz a mostrar
 */

exports.showCmd = (socket,rl, id) => {
    validateId(id)
        .then(id => models.quiz.findById(id))
        .then(quiz => {
            if(!quiz){
                throw new Error(`No existe un quiz asociado al id = ${id}.`);
            }
            log(socket,`[${colorize(quiz.id, 'magenta')}]: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
        })
        .catch(error =>{
            errorlog(socket,error.message);
        })
        .then(() =>{
            rl.prompt();
        });
};


const makeQuestion =  (rl, text) => {
    return new Sequelize.Promise((resolve, reject) => {
        rl.question(colorize(text, 'red'), answer => {
            resolve(answer.trim());
        });
    });
};



/**
 * Añadir un nuevo quiz al modelo.
 * Pregunta interactivamente por la pregunta y por la respuesta.
 */
exports.addCmd = (socket,rl )=>{
    makeQuestion(rl, 'Introduzca una pregunta: ')
        .then( pregunta => {
            return makeQuestion(rl, 'Introduzca una respuesta: ')
                .then(respuesta => {
                    return {question: pregunta, answer: respuesta};
                });
        })
        .then(quiz =>{
            return models.quiz.create(quiz);
        })
        .then(quiz =>{
            log(socket,` ${colorize('Se ha añadido', 'magenta')}: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
        })
        .catch(Sequelize.ValidationError, error =>{
            errorlog(socket,'El quiz es erróneo: ');
            error.errors.forEach(({message}) => errorlog(message));
        })
        .then(() => {
            rl.prompt();
        });
};

/**
 * Borra un quiz del modelo.
 *  @param id Clave del quiz a borrar
 */

exports.deleteCmd = (socket,rl, id) =>{
    validateId(id)
        .then(id => models.quiz.destroy({where: {id}}))
        .catch(error => {
            errorlog(socket,error.message);
        })
        .then(() => {
            rl.prompt();
        });
};


/**
 * Edita el quiz indicado.
 * @param id Clave del quiz a editar
 */
exports.editCmd = (socket, rl, id) =>{
    validateId(id)
        .then(id => models.quiz.findById(id))
        .then(quiz => {
            if(!quiz){
                throw new Error(`No existe un quiz asociado al id = ${id}. `);
            }

            process.stdout.isTTY && setTimeout(() => {rl.write(quiz.question)},0);
            return makeQuestion(rl, 'Introduzca la pregunta: ')
                .then(pregunta => {
                    process.stdout.isTTY && setTimeout(() => {rl.write(quiz.question)},0);
                    return makeQuestion(rl, 'Introduzca la respuesta: ')
                        .then(respuesta => {
                            quiz.question= pregunta;
                               quiz.answer= respuesta;
                            return quiz;
                        });
                });
        })
        .then(quiz => {
          return quiz.save();
        })
        .then(quiz =>{
            log(socket,` Se ha cambiado el quiz ${colorize(quiz.id, 'magenta')}: por ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
        })
        .catch(error => {
            errorlog(socket,error.message);
        })
        .then(() =>{
            rl.prompt();
        });
};
/**
 * Prueba el quiz indicado.
 * @param id Clave del quiz a probar
 */
exports.testCmd = (socket,rl, id) => {
    validateId(id)
        .then(id => models.quiz.findById(id))
        .then(quiz => {
            if (!quiz) {
                throw new Error(`No existe un quiz asociado al id = ${id}. `);
            }
            return makeQuestion(rl, colorize('¿' + quiz.question + '?: ', 'red'))
                .then(respuesta => {
                    if (respuesta.trim().toLowerCase() === quiz.answer.trim().toLowerCase()) {
                        log(socket,"Su respuesta es correcta.");
                        biglog(socket,"Correcta", "green");
                        rl.prompt();
                    } else {
                        log(socket,"Su respuesta es incorrecta.");
                        biglog(socket,"Incorrecta", "red");
                        rl.prompt();
                    }
                    return quiz;
                });
        })

        .catch(error => {
            errorlog(socket,error.message);
        })
        .then(() => {
            rl.prompt();
        })
};

exports.playCmd = (socket,rl) => {
    let score = 0; //preguntas que se han ido acertando
    let preguntas = [];

    const play = () => {
        return new Promise((resolve ,reject) => {
                if (preguntas.length <= 0) {
                    log(socket,`No hay nada más que preguntar.`);
                    log(socket,`Fin del juego. Aciertos: ` + score);
                    biglog(socket,score, 'magenta');
                    rl.prompt();
                }
                let posicion = Math.floor(Math.random() * preguntas.length);
                let quiz = preguntas[posicion];
                preguntas.splice(posicion, 1);
                return makeQuestion(rl, colorize('¿' + quiz.question + '?: ', 'red'))
                    .then(respuesta => {
                        if (respuesta.trim().toLowerCase() === quiz.answer.trim().toLowerCase()) {
                            score = score + 1;
                            log(socket,`CORRECTO - Lleva ` + score + ` aciertos.`);
                            play();
                        }
                        else {
                            log(socket,`INCORRECTO.`);
                            log(socket,`Fin del juego. Aciertos: ` + score);
                            biglog(socket,score, 'magenta');
                            rl.prompt();
                        }
                    })

        })

    }

    models.quiz.findAll({
        raw:true,
    })
        .then(quizzes =>{
            preguntas=quizzes;
        })

        .then(() => {
            return play();
        })
        .catch(error => {
            errorlog(socket,error.message);
        })
        .then(() =>{
            rl.prompt();
        })
};

/**
 * Creditos.
 */
exports.creditCmd = (socket,rl)  =>{
    log(socket,"Autor de la practica");
    log(socket,"Carlos",'green');
    rl.prompt();

};

/**
 * Salimos del programa.
 */
exports.quitCmd = (socket,rl)  =>{
    rl.close();
    socket.end();
    rl.prompt();

};


