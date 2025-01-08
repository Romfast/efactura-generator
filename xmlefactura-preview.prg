* VFP -> POST XML -> PHP -> Salveaza în fixier /temp/xml_xxx.xml -> BROWSER Afiseaza date

* trimite un fisier xml eFactura la romfast.ro/efactura-generator/receier.php
* receiver.php salveaza fisierul xml pe server in directul /temp si intoarce json cu numele fierului xml
* se deschide browserul cu romfast.ro/efactura-generator/index.html?xml=fisier.xml pentru editare fisier xml

* Program principal
Local loSender
loSender = Createobject("eFacturaXmlPreview")
loSender.webURL = "https://mywebsite.ro/efactura-generator/"
loSender.SendXML("C:\temp\factura.xml")

*** Program pentru trimitere XML pe server romfast.ro si previzualizare web
Define Class eFacturaXmlPreview As Custom
	* Configurari
	webURL = "https://mywebsite.ro/efactura-generator/"
	apiKey = "1234567890."
	debugMode = .F.  && Mod depanare pentru înregistrari detaliate

	* Procedura principala pentru trimitere XML
	Procedure SendXML
		Parameters tcXMLFile, tlVariable
		
		* tcXMLFile: calea catre fisier xml sau continutul unui fisier xml (tlVariable = .T.)
		* tlVariable: .T. daca tcXMLFile este continutul unui fisier, in loc de calea catre fisier

		Local loXMLHTTP, lcResponse, lcFileName, lcXML, llSucces, loXMLDoc
		llSucces = .T.
		lcResponse = ''
		lcFileName = ''
		lcXML = ''
		loXMLDoc = Null
		Set Step On
		* Curata fisierele debug anterioare
		If This.debugMode
			Try
				Erase "debug_xml_sent.txt"
				Erase "debug_response.txt"
				Erase "debug_headers.txt"
				Erase "debug_status.txt"
			Catch
			Endtry
		Endif

		Try
			* Verifica existenta fisierului
			If !m.tlVariable AND !File(tcXMLFile)
				Messagebox("Fisierul XML nu exista: " + tcXMLFile, 16, "Eroare")
				llSucces = .F.
			Endif

			* Citeste XML-ul cu codare UTF-8 explicita
			If m.llSucces
				IF m.tlVariable
					lcXML = m.tcXMLFile
				ELSE 	
					lcXML = Strconv(Filetostr(tcXMLFile), 9)
				ENDIF 	

				* Elimina potentialul BOM (Byte Order Mark)
				If Substr(lcXML, 1, 3) = Chr(239) + Chr(187) + Chr(191)
					lcXML = Substr(lcXML, 4)
				Endif

				* Validare structura XML înainte de trimitere
				If Empty(Alltrim(lcXML))
					Messagebox("Fisierul XML este gol!", 16, "Eroare")
					llSucces = .F.
				Endif
			Endif

			* Validare XML folosind MSXML
			If m.llSucces
				Try
					loXMLDoc = Createobject("MSXML2.DOMDocument.6.0")
					loXMLDoc.Async = .F.
					loXMLDoc.LoadXML(lcXML)

					If loXMLDoc.ParseError.Errorcode <> 0
						Messagebox("Eroare parsare XML: " + loXMLDoc.ParseError.Reason, 16, "Eroare XML")
						llSucces = .F.
					Endif
				Catch To loXMLException
					Messagebox("Eroare validare structura XML: " + loXMLException.Message, 16, "Eroare Validare")
					llSucces = .F.
				Endtry
			Endif

			* Salveaza XML-ul pentru depanare
			If This.debugMode
				Strtofile(lcXML, "debug_xml_sent.txt")
			Endif

			If m.llSucces
				* Creeaza obiectul XMLHTTP pentru trimitere
				loXMLHTTP = Createobject("MSXML2.ServerXMLHTTP.6.0")

				* Configureaza timeout si alti parametri
				loXMLHTTP.SetTimeouts(30000, 30000, 30000, 30000)

				* Deschide conexiunea
				loXMLHTTP.Open("POST", This.webURL + "receiver.php", .F.)

				* Seteaza headere
				loXMLHTTP.setRequestHeader("Content-Type", "application/xml; charset=UTF-8")
				loXMLHTTP.setRequestHeader("X-Api-Key", This.apiKey)

				* Trimite XML-ul
				loXMLHTTP.Send(m.lcXML)

				* Salveaza antetele si statusul pentru depanare
				If This.debugMode
					Strtofile(loXMLHTTP.getAllResponseHeaders(), "debug_headers.txt")
					Strtofile(Transform(loXMLHTTP.Status), "debug_status.txt")
					Strtofile(loXMLHTTP.responseText, "debug_response.txt")
				Endif

				* Proceseaza raspunsul serverului
				Do Case
					Case loXMLHTTP.Status = 200
						lcResponse = loXMLHTTP.responseText
						lcFileName = This.GetJSONValue(lcResponse, "fileName")

						If !Empty(lcFileName)
							This.OpenBrowser(This.webURL + "index.html?xml=" + lcFileName)
							llSucces = .T.
							Messagebox("XML trimis cu succes!", 64, "Succes")
						Else
							Messagebox("Nu s-a primit numele fisierului în raspuns." + Chr(13) + ;
								"Raspuns server: " + loXMLHTTP.responseText, 16, "Eroare")
						Endif

					Case loXMLHTTP.Status = 400
						* Eroare de validare XML
						Messagebox("XML invalid! Detalii:" + Chr(13) + ;
							loXMLHTTP.responseText, 16, "Eroare Validare XML")
						llSucces = .F.

					Case loXMLHTTP.Status = 401
						Messagebox("Token invalid!", 16, "Eroare Autentificare")
						llSucces = .F.

					Case loXMLHTTP.Status = 403
						Messagebox("Acces interzis! IP-ul nu este autorizat.", 16, "Eroare Acces")
						llSucces = .F.

					Otherwise
						Messagebox("Eroare la trimiterea XML-ului: " + loXMLHTTP.responseText + ;
							CHR(13) + "Status: " + Transform(loXMLHTTP.Status), ;
							16, "Eroare")
						llSucces = .F.
				Endcase

			Endif && llSucces

		Catch To loException
			llSucces = .F.
			Messagebox("Eroare generala: " + loException.Message + ;
				CHR(13) + "Detalii în fisierele debug", ;
				16, "Eroare")

			* Salveaza XML-ul de eroare
			If This.debugMode
				Strtofile(lcXML, "debug_xml_error.txt")
			Endif
		Endtry

		Return llSucces
	Endproc

	* Extrage valoarea dintr-un JSON simplu
	Function GetJSONValue
		Lparameters tcJSON, tcKey
		Local lcPattern, lnPosStart, lnPosEnd, lcValue

		* Creeaza un pattern pentru cheia JSON
		lcPattern = '"' + tcKey + '":'

		* Gase?te pozi?ia de start a valorii
		lnPosStart = At(lcPattern, tcJSON)
		If lnPosStart = 0
			Return ""
		Endif

		lnPosStart = lnPosStart + Len(lcPattern)

		* Gaseste pozitia delimitatorului de sfarsit
		lnPosEnd = At(",", tcJSON, lnPosStart)
		If lnPosEnd = 0
			lnPosEnd = At("}", tcJSON, 1) && Daca nu gaseste virgula, cauta acolada de închidere
		Endif

		If lnPosEnd = 0
			Return "" && Daca nici acum nu gaseste delimitator, JSON-ul este invalid
		Endif

		* Extrage valoarea
		lcValue = Substr(tcJSON, lnPosStart, lnPosEnd - lnPosStart)
		lcValue = Alltrim(Strtran(lcValue, '"', ""))

		Return lcValue
	Endfunc



	* Deschide browser-ul
	Procedure OpenBrowser
		Parameters tcURL

		Declare Integer ShellExecute In shell32.Dll ;
			INTEGER hndWin, ;
			STRING cOperation, ;
			STRING cFileName, ;
			STRING cParams, ;
			STRING cDir, ;
			INTEGER nShowWin

		ShellExecute(0, "open", tcURL, "", "", 1)
	Endproc
Enddefine


