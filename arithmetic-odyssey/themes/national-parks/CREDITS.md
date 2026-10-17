# Off-Roading picture credits

Every picture in `pictures/` needs a line here saying where it came from, so any picture can be checked or replaced later. This repository and the published game are public, so only add pictures you are allowed to share. Photos taken by National Park Service staff are generally in the public domain; check the credit on each photo.

**Pictures from the downloader.** `tools/Get-ParkPictures.ps1` writes `credits.csv` (in `downloaded-pictures/`) with the author, license and Wikimedia Commons page of every picture it downloads. Copy that file into this folder (`themes/national-parks/credits.csv`): the story file builder counts each picture listed in it as credited, so those pictures need no line below. Rows for pictures you didn't keep do no harm.

A line below can name one picture (`pictures/Alaska/Denali/denali-1.jpg`) or a whole folder with `/**` at the end (`pictures/Alaska/**`).

| Picture file | National park | Source (website or photographer) | License or permission |
| --- | --- | --- | --- |
| `pictures/Alaska/**` | Alaska parks | Wikimedia Commons, downloaded with `tools/Get-ParkPictures.ps1`. The author of each picture is not recorded yet. | Unknown. |
| `sounds/flag-1.mp3` | Flag engine 1 | "Truck-diesel 07dodge rev" by canucklovingbrit on [Freesound](https://freesound.org/s/478125/), trimmed to 4.7 s and evened out | Not checked yet: see the Freesound page |
| `sounds/flag-2.mp3` | Flag engine 2 | "Truck uphill" by moshwe on [Freesound](https://freesound.org/s/554426/), trimmed to 4.8 s and evened out | Not checked yet: see the Freesound page |
