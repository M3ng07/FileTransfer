# Come Avviare L'App

Non usare ▶ per avviare il programma. Usa le attività:
- Ctrl+Shift+B per compilare
- Terminale → Esegui attività → "Avvia server"
- Terminale → Esegui attività → "Avvia client"
I file client.obj, client.pdb e vc140.pdb creati dal tentativo fallito sono file temporanei di compilazione: puoi cancellarli, non servono a niente e non danno fastidio.

## Se vuoi usare il tasto ▶ o F5:
Bisogna dire a VS Code di usare il nostro script al posto di quella compilazione automatica, aggiungendo un file launch.json con il debugger di Visual Studio (cppvsdbg). 
In questo modo puoi anche mettere breakpoint e seguire il codice riga per riga, cosa molto utile mentre impari il C. 
