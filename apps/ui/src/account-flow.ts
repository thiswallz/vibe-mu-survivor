import { CLASSES } from '@mu-survivor/game';
import type { CharacterSummary } from '@mu-survivor/models';
import type { HeroId, AccountResponse } from '@mu-survivor/models';
import {
  activeCharacter,
  isGuest,
  selectGuest,
  request,
  selectCharacter,
  flushSaves,
  clearSession,
} from './account-session.js';
interface CharacterFlowView {
  preview(hero: HeroId, fresh: boolean): void;
  stages(hero: HeroId): void;
  play(): void;
}
export function mountAccountFlow(view: CharacterFlowView) {
  const panel = document.createElement('section');
  panel.id = 'account-gate';
  document.body.append(panel);
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  let busy = false;
  async function perform(action: () => Promise<void>) {
    if (busy) return;
    busy = true;
    panel.inert = true;
    panel.setAttribute('aria-busy', 'true');
    try {
      message.textContent = '';
      await action();
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Connection failed';
      panel.append(message);
    } finally {
      busy = false;
      panel.inert = false;
      panel.removeAttribute('aria-busy');
    }
  }
  function validate(form: HTMLFormElement) {
    for (const input of form.querySelectorAll<HTMLInputElement>('input')) {
      if (!input.checkValidity()) {
        message.textContent = `${input.name === 'username' ? 'Username' : input.name === 'password' ? 'Password' : 'Name'}: ${input.validationMessage}`;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return false;
      }
      input.removeAttribute('aria-invalid');
    }
    return true;
  }
  function enterCharacter(name: string, heroClass: HeroId) {
    view.stages(heroClass);
    panel.classList.remove('character-screen');
    document.body.classList.remove('choosing-character');
    panel.hidden = true;
    document.getElementById('selected-character')!.textContent = name;
  }
  function login(register = false) {
    message.textContent = '';
    panel.classList.remove('character-screen');
    document.body.classList.remove('choosing-character');
    panel.hidden = false;
    panel.innerHTML = `<div class="eyebrow">WELCOME TO MU</div><h1>${register ? 'Create your account' : 'Enter the realm'}</h1><p>${register ? 'Choose a username and password. No email required.' : 'Your account. Your heroes. Your journey.'}</p><form novalidate><label>Username<input name="username" autocomplete="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" aria-describedby="username-help"></label><small id="username-help">3–20 letters, numbers or underscores.</small><label>Password<input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" required minlength="8" maxlength="128" aria-describedby="password-help"></label><small id="password-help">8–128 characters.</small><button class="primary" type="submit">${register ? 'CREATE ACCOUNT' : 'SIGN IN'}</button></form><button class="secondary" id="auth-switch">${register ? 'BACK TO SIGN IN' : 'CREATE ACCOUNT'}</button><button class="secondary" id="guest">PLAY AS GUEST</button>`;
    panel.querySelector('form')!.onsubmit = (e) => {
      e.preventDefault();
      const form = panel.querySelector('form')!;
      if (!validate(form)) return;
      void perform(async () => {
        const button = form.querySelector('button')!;
        button.disabled = true;
        button.textContent = register ? 'CREATING ACCOUNT…' : 'SIGNING IN…';
        try {
          const data = new FormData(form);
          await request(register ? 'register' : 'login', 'POST', {
            username: String(data.get('username')).trim(),
            password: data.get('password'),
          });
          await roster();
        } finally {
          button.disabled = false;
          button.textContent = register ? 'CREATE ACCOUNT' : 'SIGN IN';
        }
      });
    };
    panel.querySelector<HTMLButtonElement>('#auth-switch')!.onclick = () => login(!register);
    panel.querySelector<HTMLButtonElement>('#guest')!.onclick = guest;
    panel.append(message);
  }
  function showCharacterScreen() {
    message.textContent = '';
    panel.hidden = false;
    panel.classList.add('character-screen');
    document.body.classList.add('choosing-character');
  }
  function guest() {
    createCharacter(true);
  }
  function createCharacter(guestMode = false) {
    showCharacterScreen();
    let chosen: HeroId = 'knight';
    view.preview(chosen, true);
    panel.innerHTML = `<div class="eyebrow">${guestMode ? 'GUEST ADVENTURE' : 'NEW CHARACTER'}</div><h1>Create your hero</h1><p>Choose a class, then give your hero a name.</p><div class="class-options" role="group" aria-label="Character class"></div><p id="class-description"></p><form novalidate><label>Character name<input name="name" ${guestMode ? 'value="Guest"' : ''} required minlength="3" maxlength="16" pattern="[A-Za-z][A-Za-z0-9_]+" autocomplete="off"></label><small>3–16 letters, numbers or underscores. Start with a letter.${guestMode ? ' Guest gear lasts until refresh.' : ' Names must be unique.'}</small><button class="primary">${guestMode ? 'CONTINUE AS GUEST' : 'CREATE CHARACTER'}</button></form><button class="secondary" id="creation-back">${guestMode ? 'BACK TO SIGN IN' : 'BACK TO CHARACTERS'}</button>`;
    for (const hero of CLASSES) {
      const button = document.createElement('button');
      button.className = 'secondary';
      button.textContent = hero.name;
      button.dataset.class = hero.id;
      button.onclick = () => {
        chosen = hero.id;
        view.preview(chosen, true);
        updateClass();
      };
      panel.querySelector('.class-options')!.append(button);
    }
    function updateClass() {
      for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-class]'))
        button.setAttribute('aria-pressed', String(button.dataset.class === chosen));
      panel.querySelector('#class-description')!.textContent = CLASSES.find(
        (hero) => hero.id === chosen,
      )!.description;
    }
    updateClass();
    panel.querySelector('form')!.onsubmit = (e) => {
      e.preventDefault();
      const form = panel.querySelector('form')!;
      if (!validate(form)) return;
      void perform(async () => {
        const button = form.querySelector('button')!;
        button.disabled = true;
        try {
          const name = String(new FormData(form).get('name'));
          if (guestMode) await selectGuest(name, chosen);
          else {
            const character = await request<CharacterSummary>('characters', 'POST', {
              name,
              class: chosen,
            });
            await selectCharacter(character);
          }
          enterCharacter(name, chosen);
        } finally {
          button.disabled = false;
        }
      });
    };
    panel.querySelector<HTMLButtonElement>('#creation-back')!.onclick = () => {
      if (guestMode) login();
      else void perform(() => roster(false));
    };
    panel.append(message);
  }
  async function roster(autoCreate = true) {
    await flushSaves();
    const account = await request<AccountResponse>('account');
    showCharacterScreen();
    panel.innerHTML = `<div class="eyebrow">CHARACTER SELECTION</div><h1>Your heroes</h1><p id="account-name"></p><div id="roster"></div><button class="primary" id="select-character" disabled>SELECT CHARACTER</button><button class="secondary" id="new-character" ${account.characters.length >= 10 ? 'disabled' : ''}>CREATE CHARACTER</button><button class="secondary" id="logout">SIGN OUT</button>`;
    panel.querySelector('#account-name')!.textContent =
      `${account.username} · ${account.characters.length} / 10 characters`;
    let chosen: CharacterSummary | null = null;
    let previewVersion = 0;
    const selectButton = panel.querySelector<HTMLButtonElement>('#select-character')!;
    async function preview(character: CharacterSummary) {
      const version = ++previewVersion;
      selectButton.disabled = true;
      await selectCharacter(character);
      if (version !== previewVersion) return;
      chosen = character;
      view.preview(character.class, false);
      for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-character]'))
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.character === String(character.id)),
        );
      selectButton.disabled = false;
    }
    for (const character of account.characters) {
      const button = document.createElement('button');
      button.className = 'secondary';
      button.dataset.character = String(character.id);
      button.textContent = `${character.name} · ${CLASSES.find((hero) => hero.id === character.class)!.name}`;
      button.onclick = () => void perform(() => preview(character));
      panel.querySelector('#roster')!.append(button);
    }
    selectButton.onclick = () => {
      if (chosen) enterCharacter(chosen.name, chosen.class);
    };
    panel.querySelector<HTMLButtonElement>('#new-character')!.onclick = () => createCharacter();
    panel.querySelector<HTMLButtonElement>('#logout')!.onclick = () =>
      void perform(async () => {
        await flushSaves();
        await request('logout', 'POST', {});
        clearSession();
        login();
      });
    panel.append(message);
    if (account.characters.length)
      await preview(
        account.characters.find((character) => character.id === activeCharacter?.id) ||
          account.characters[0],
      );
    else if (autoCreate) createCharacter();
    else view.preview('knight', true);
  }
  document.getElementById('change-character')!.onclick = () => {
    if (isGuest) guest();
    else void perform(roster);
  };
  document.getElementById('begin')!.onclick = () => {
    if (activeCharacter) view.play();
  };
  void perform(async () => {
    try {
      await roster();
    } catch {
      login();
    }
  });
}
