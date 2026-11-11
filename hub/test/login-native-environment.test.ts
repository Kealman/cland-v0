// T1: admitted native command decoration and shared remote filtering; no processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureEnvironment} from './fixture-environment.ts';
import {remoteCommandEnvironment} from '../src/host/command-environment.ts';
import {nativeLoginEnvironment} from './login-native-environment.ts';

test('native login decoration retains admitted account and routing fields with sealed inherited environment',()=>{
 const sealed=fixtureEnvironment('/scratch',{OPENAI_API_KEY:'inherited-sentinel',DIGITALOCEAN_TOKEN:'inherited-provider',GIT_DIR:'/inherited/repo',GIT_CONFIG_COUNT:'1'});
 const admitted={...sealed,OPENCODE_PASSWORD:'native-sentinel',OPENCODE_CONFIG:'/scratch/native.json',OPENCODE_DB:'/scratch/login.db',CLAUDE_CONFIG_DIR:'/scratch/claude-login',CLAND_LAUNCH_TOKEN:'native-generation',CLAND_HUB_FILE:'/scratch/hub.json'};
 const result=remoteCommandEnvironment(nativeLoginEnvironment(admitted,{FAKE_LOGIN_ENABLED:'1',FAKE_LOGIN_HOME:'/scratch/login'}));
 for(const key of ['OPENCODE_PASSWORD','OPENCODE_CONFIG','OPENCODE_DB','CLAUDE_CONFIG_DIR','CLAND_LAUNCH_TOKEN','CLAND_HUB_FILE'])assert.equal(result[key],admitted[key as keyof typeof admitted]);
 for(const key of ['OPENAI_API_KEY','DIGITALOCEAN_TOKEN','GIT_DIR','GIT_CONFIG_COUNT'])assert.equal(result[key],undefined);
 assert.equal(result.FAKE_LOGIN_HOME,'/scratch/login');assert.equal(result.FAKE_LOGIN_ENABLED,'1');
 assert.equal(Object.hasOwn(admitted,'FAKE_LOGIN_ENABLED'),false);
});
