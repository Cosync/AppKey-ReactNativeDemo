/* eslint-disable react-native/no-inline-styles */

//
//  LoginScreen.js
//  AppKey
//
//  Licensed to the Apache Software Foundation (ASF) under one
//  or more contributor license agreements.  See the NOTICE file
//  distributed with this work for additional information
//  regarding copyright ownership.  The ASF licenses this file
//  to you under the Apache License, Version 2.0 (the
//  "License"); you may not use this file except in compliance
//  with the License.  You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing,
//  software distributed under the License is distributed on an
//  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
//  KIND, either express or implied.  See the License for the
//  specific language governing permissions and limitations
//  under the License.
//
//  Created by Tola Voeung.
//  Copyright © 2023 cosync. All rights reserved.
//

import React, {useEffect, useState, useRef, useContext } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Linking
} from 'react-native';
 
import { Passkey } from 'react-native-passkey';
import base64url from 'base64url';
import { appleAuth, AppleButton } from '@invertase/react-native-apple-authentication';
import {
  GoogleSignin
} from '@react-native-google-signin/google-signin';

import { AuthContext } from '../context/AuthContext';
import {Config} from '../config/Config';

const LoginScreen = props => {

  let [userHandle, setUserHandle] = useState(); 
  let [token, setToken] = useState(); 
  let [isResetingKey, setResetingKey] = useState(false); 
  let [errortext, setErrortext] = useState(''); 
  const { validateInput, socialLogin, socialSignup, login, loginComplete, loginAnonymous, loginAnonymousComplete, appData, addPasskey, addPasskeyComplete} = useContext(AuthContext);
  global.Buffer = require('buffer').Buffer;

  useEffect(() => {
    if (!Passkey.isSupported()) {alert('Your device does not have Passkey Authentication.');}

    return appleAuth.onCredentialRevoked(async () => {
      console.warn('If this function executes, User Credentials have been Revoked');
    });


  }, []);

  useEffect(() => {

    if (appData && appData.googleLoginEnabled){

      GoogleSignin.configure({
        iosClientId: Config.GOOGLE_CLIENT_ID,
      });

    }


  }, [appData]);



  const loginAnonymousUser = async () => {

    try {
     

      let resultAnon = await loginAnonymous();
      console.log('AppKey loginAnonymous resultAnon  ', resultAnon);
      
      if(resultAnon.error){
        setErrortext(resultAnon.error.message);
      }
      else {
        resultAnon.challenge = base64url.toBase64(resultAnon.challenge);

        let result = await Passkey.register(resultAnon);

        console.log('sign passkey attResponse ', result);

        const convertToRegistrationResponse = {
          ...result,
          id: base64url.fromBase64(result.id),
          rawId: base64url.fromBase64(result.rawId),
          response: {
            ...result.response,
            attestationObject: base64url.fromBase64(result.response.attestationObject),
            clientDataJSON: base64url.fromBase64(result.response.clientDataJSON),
            clientExtensionResults: {}, 
            email:resultAnon.user.handle,
          },
          type: 'public-key',
          handle:resultAnon.user.handle,
        };
        let authn = await loginAnonymousComplete(convertToRegistrationResponse);

        if(authn.error) {setErrortext(`Error: ${authn.error.message}`);}


      }

    } catch (error) {
      setErrortext(error.message);
    }
    

  };
 
  const addPasskeyHandler = async () => {

    if (!token || token === '') {
      alert('Please fill a valid token');
      return;
    }

    let data = {
      'access-token' : token
    };

    let challenge = await addPasskey(data);
    
    if (challenge.error) {
      setErrortext('error', challenge.error.message);
    }
    else {
      challenge.challenge = base64url.toBase64(challenge.challenge);

      let result = await Passkey.register(challenge);
      const convertToRegistrationResponse = {
        ...result,
        id: base64url.fromBase64(result.id),
        rawId: base64url.fromBase64(result.rawId),
        response: {
          ...result.response,
          attestationObject: base64url.fromBase64(result.response.attestationObject),
          clientDataJSON: base64url.fromBase64(result.response.clientDataJSON),
          clientExtensionResults: {},
          email: userHandle,
        },
        type: 'public-key',
        handle: userHandle,
        'access-token': token,
      };

      let authn = await addPasskeyComplete(convertToRegistrationResponse);

      if (authn.error) { setErrortext('error', `Error: ${authn.error.message}`); }
      else {
        setErrortext('success', 'Success');
      }

    }
  };



  const handleSubmitLogin = async () => {
    setErrortext('');


    if (!validateInput(userHandle)) {
      alert('Please fill a valid handle');
      return;
    }
 

    try {
      let result = await login(userHandle);

      if(result.code && result.message)  setErrortext(result.message);
      else if (result.requireAddPasskey) setResetingKey(true)
      else{


        console.log('Passkey login result ', result);

        result.challenge = base64url.toBase64(result.challenge);

        let assertion = await Passkey.authenticate(result);

        console.log('Passkey.authenticate assertion ', assertion);

        if(!assertion.id){
          setErrortext('Invalid Passkey');
          return;
        }


        const convertToAuthenticationResponseJSON = {

          id: base64url.fromBase64(assertion.id),
          rawId: base64url.fromBase64(assertion.rawId),
          response: {
            clientDataJSON: base64url.fromBase64(assertion.response.clientDataJSON),
            authenticatorData: base64url.fromBase64(assertion.response.authenticatorData),
            signature: base64url.fromBase64(assertion.response.signature),
          },
          clientExtensionResults: {},
          type: 'public-key',
          handle: userHandle
        };

        let authn = await loginComplete( convertToAuthenticationResponseJSON);
        console.log('loginResult ', authn);

        if(authn.error) {setErrortext(`Error: ${authn.error.message}`);}
      }

    } catch (error) {
      console.error(error);
      setErrortext(error.message);
    }
    
  };


  async function onGoogleLoginPress() {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.type === 'success') {
        console.log(response.data);

        socialLoginHandler(response.data.idToken, response.data.user, 'google');

      } else {
        // sign in was cancelled by user
        setErrortext(`AppKey Google User Response: ${response.type}`);

      }


    } catch (error) {
      console.error('ERROR: ', error);
      setErrortext(`AppKey: ${error.message}`);
      return error;
    }

  }

  async function socialLoginHandler(token, profile, provider) {
    try {
     

      let result = await socialLogin(token, provider, false);
      console.log('socialLoginHandler result ', result);

      if(result.error){

        if(result.error.code === 603){

          //setErrortext('AppKey: Creating New Account');
          let displayName;
          if(provider === 'apple' ) {
            if(profile.fullName.givenName) {
              displayName = `${profile.fullName.givenName} ${profile.fullName.familyName}`
              socialSignupHandler(token, 'apple', profile.email, displayName);
            }
            else {
              let errorMessage = "App cannot access to your profile name. Please remove this AppKey in 'Sign with Apple' from your icloud setting and try again.";
              setErrortext(`AppKey: ${errorMessage}`);
            }
          }
          else {
            displayName = `${profile.givenName} ${profile.familyName}`
            socialSignupHandler(token, 'google', profile.email, displayName);
          }

        }
        else {
          setErrortext(`AppKey: ${result.error.message}`);
        }
      }

    } catch (error) {
      console.log('socialLoginHandler error ', error)
      setErrortext(`Error: ${error.message}`);
    }
     
  }

  async function onAppleButtonPress() {

    try {

      // performs login request
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        // Note: it appears putting FULL_NAME first is important, see issue #293
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });



      // get current authentication state for user
      // /!\ This method must be tested on a real device. On the iOS simulator it always throws an error.
      const credentialState = await appleAuth.getCredentialStateForUser(appleAuthRequestResponse.user);

      console.log('credentialState = ', credentialState);

      // use credentialState response to ensure the user is authenticated
      if (credentialState === appleAuth.State.AUTHORIZED) {
        // user is authenticated

        console.log('appleAuthRequestResponse identityToken ', appleAuthRequestResponse.identityToken);
        console.log('appleAuthRequestResponse fullName ', appleAuthRequestResponse.fullName);


        socialLoginHandler(appleAuthRequestResponse.identityToken, appleAuthRequestResponse, 'apple');


      }

    } catch (error) {
      setErrortext(`AppKey: ${error.message}`);
    }
    
  }

  async function socialSignupHandler(token, provider, handle, displayName, locale) {
    try {
      
      let result = await socialSignup(token, provider, handle, displayName, locale);
      if(result.error) {setErrortext(`Error: ${result.error.message}`);}

    } catch (error) {
      setErrortext(`Error: ${error.message}`);
    } 
  }

  async function openLink(url) {
    await Linking.openURL(url);
  }


  return (
    <View style={styles.mainBody}>
     

      <ScrollView keyboardShouldPersistTaps="handled"> 
          <KeyboardAvoidingView enabled>
            <View style={styles.logoSection}>
              <TouchableOpacity style={{ alignItems: 'center'}} onPress={() => openLink('https://cosync.io')}>
                <Image
                  source={require('../assets/cosync_bricks.png')}
                  style={{ 
                    height: 70,
                    width: 70,
                    resizeMode: 'contain',
                    marginTop: 30,
                    marginLeft: 20,
                  }}
                /> 
              </TouchableOpacity>

              <TouchableOpacity style={{alignItems:'center'}} onPress={() => openLink('https://appkey.info')}>
                <Image
                  source={require('../assets/applogo.png')}
                  style={{
                    height: 70,
                    width: 70,
                    resizeMode: 'contain',
                    marginTop: 30,
                    marginRight: 20,
                  }}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.headerTextStyle}>Welcome to the AppKey demo! Log in securely using your passkey or sign up with your email to create one in seconds. See for yourself how fast and seamless passkey creation can be with AppKey—no passwords, no hassle, just security made simple.</Text>
            </View>
            
            {
            isResetingKey ? 
            <View>

              <View style={styles.infoSection}>
                <Text style={styles.infoTextStyle}>Your account has been requested to reset passkey. Please enter a reset passkey token.</Text>
              </View>

                <View style={styles.sectionStyleBig}>
                  <TextInput
                    style={styles.inputStyle}
                    value={token}
                    multiline={true}
                    numberOfLines={6}
                    onChangeText={value => setToken(value)}
                    placeholder="Enter Reset Token"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="text"
                    returnKeyType="next"
                    onSubmitEditing={() => addPasskeyHandler}
                    blurOnSubmit={false}

                  />
                </View>

                <TouchableOpacity
                  style={styles.buttonStyle}
                  activeOpacity={0.5}
                  onPress={addPasskeyHandler}>
                  <Text style={styles.buttonTextStyle}>SUBMIT</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.buttonStyle}
                  activeOpacity={0.5}
                  onPress={ () => { setResetingKey(false)} }>
                  <Text style={styles.buttonTextStyle}>CANCEL</Text>
                </TouchableOpacity>
                
            </View> 
            : <View>
              <View style={styles.sectionStyle}>
                <TextInput
                  style={styles.inputStyle}
                  value={userHandle}
                  onChangeText={value => setUserHandle(value)}
                  placeholder="Enter handle"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => handleSubmitLogin}
                  blurOnSubmit={false}

                />
              </View>


              {errortext != '' && <Text style={styles.errorTextStyle}> {errortext} </Text>}
              <TouchableOpacity
                style={styles.buttonStyle}
                activeOpacity={0.5}
                onPress={handleSubmitLogin}>
                <Text style={styles.buttonTextStyle}>LOGIN</Text>
              </TouchableOpacity>
              {appData && appData.anonymousLoginEnabled &&
                <TouchableOpacity
                  style={styles.buttonStyle}
                  activeOpacity={0.5}
                  onPress={loginAnonymousUser}>
                  <Text style={styles.buttonTextStyle}>LOGIN AS ANONYMOUS</Text>
                </TouchableOpacity>
              }
              <TouchableOpacity
                style={styles.buttonStyle}
                activeOpacity={0.5}
                onPress={() => props.navigation.navigate('Signup')}>
                <Text style={styles.buttonTextStyle}> SIGNUP</Text>
              </TouchableOpacity>

              {appData && (appData.googleLoginEnabled || appData.appleLoginEnabled) &&   <Text style={styles.headerTextStyle}> OR </Text>  }

              {appData && appData.appleLoginEnabled && appData.appleBundleId &&
                <View style={styles.SectionCenterStyle}>
                  <AppleButton
                    buttonStyle={AppleButton.Style.BLACK}
                    buttonType={AppleButton.Type.SIGN_IN}
                    style={{
                      width: 220, // You must specify a width
                      height: 45, // You must specify a height
                    }}
                    onPress={() => onAppleButtonPress()}
                  />
                </View>
              }

              {appData && appData.googleLoginEnabled && appData.googleClientId &&
                  <TouchableOpacity
                    style={styles.buttonStyle}
                    activeOpacity={0.5}
                    onPress={onGoogleLoginPress}>
                    <Text style={styles.buttonTextStyle}> Sign In With Google</Text>
                  </TouchableOpacity>
              }
            </View>}

          </KeyboardAvoidingView>

      </ScrollView>
    </View>
  );
};
export default LoginScreen;

const styles = StyleSheet.create({
  mainBody: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  logoSection:{ 
    flexDirection: 'row',
    justifyContent:'space-between'
  },
  sectionStyleBig: {
    flexDirection: 'row',
    height: 120,
    marginTop: 20,
    marginLeft: 35,
    marginRight: 35,
    margin: 10,
  },
  sectionStyle: {
    flexDirection: 'row',
    height: 40,
    marginTop: 20,
    marginLeft: 35,
    marginRight: 35,
    margin: 10,
  },
  SectionCenterStyle: {
    alignItems: 'center',
    height: 40,
    marginTop: 20,
    marginLeft: 35,
    marginRight: 35,
    margin: 10,
  },
  buttonStyle: {
    backgroundColor: '#4638ab',
    borderWidth: 0,
    color: '#FFFFFF',
    borderColor: '#7DE24E',
    height: 40,
    alignItems: 'center',
    borderRadius: 30,
    marginLeft: 35,
    marginRight: 35,
    marginTop: 20,
    marginBottom: 20,
  },
  buttonTextStyle: {
    color: 'white',
    fontWeight: 'bold',
    paddingVertical: 10,
    fontSize: 16,
  },
  inputStyle: {
    flex: 1,
    color: '#4638ab',
    paddingLeft: 15,
    paddingRight: 15,
    borderWidth: 1,
    borderRadius: 15,
    borderColor: '#4638ab',
  },
  headerTextStyle: {
    color: '#4638ab',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 14,
  },
  infoTextStyle: {
    color: '#000',
    textAlign: 'center', 
    fontSize: 14,
  },
  infoSection:{ 
    margin: 10,
    paddingBottom:10
  },
  errorTextStyle: {
    color: 'red',
    textAlign: 'center',
    fontSize: 14,
  },
});
