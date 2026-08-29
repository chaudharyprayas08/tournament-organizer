
# Hacking PickleBall tournament website




## Hack 1 -> Login as admin
    Pasting new key value pair to the localstorage 
    {
        Key : pbAdmin2025
        value : yes
    }
    you can login as admin No need of password.

## Hack 2 -> Access Firebase database
    Api keys of Firebase are visiable to the normal user

    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyCRCbLh36ccZX_F8arJIaTzM0reQeA_afE",
        authDomain: "tournamentorganizer08.firebaseapp.com",
        databaseURL:
          "https://tournamentorganizer08-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "tournamentorganizer08",
        storageBucket: "tournamentorganizer08.appspot.com",
        messagingSenderId: "318742717136",
        appId: "1:318742717136:web:468f148821bb3aa299f4d5",
      };

    so Normal user can simply use this Api to store or update and entry in the database 

    