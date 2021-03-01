const { getModule, i18n: { Messages } } = require('powercord/webpack');
const { ContextMenu } = require('powercord/components');

const { existsSync } = require('fs');
const { join } = require('path');
const { writeFile } = require('fs').promises;
const { clipboard, shell } = require('electron');

const { getDownloadPath } = require('../utils');
const imageSearchServices = require('../ReverseImageSearchServices.json');

/* eslint-disable no-use-before-define */
module.exports.getButton = function (images, { get }) {
  const baseExtensions = Object.keys(images);
  const disabledISS = get('disabledImageSearchServices', []);
  const downloadPath = getDownloadPath(get('pathSave', null));
  const disabled = {
    webp: get('disableWebp', true),
    mp4: [ 'openImage', 'copyImage', 'saveAs', 'searchImage' ]
  };

  const items = baseExtensions.filter((e) => {
    if (!images[e]) {
      return false;
    }
    if (e in disabled) {
      return (Array.isArray(disabled[e])) ? true : !disabled[e];
    }
    return true;
  });

  const getDisabledMethods = (e) => Array.isArray(disabled[e]) ? disabled[e] : [];

  return [
    ...ContextMenu.renderRawItems([
      {
        type: 'submenu',
        id: 'image-tools-button',
        name: Messages.IMAGE,
        items: getSubItems(),
        getItems () {
          return this.items;
        }
      }
    ])
  ][0];

  function getSubItems () {
    if (items.length > 1) {
      return items.map((e) => ({
        type: 'submenu',
        name: e.toUpperCase(),
        items: getBaseMenu(images[e], getDisabledMethods(e)),
        getItems () {
          return this.items;
        }
      }));
    }
    return getBaseMenu(images[items[0]], getDisabledMethods(items[0]));
  }

  function getBaseMenu (image, disabled) {
    const url = (image.content) ? image.content : image.src;
    return [
      {
        type: 'button',
        name: Messages.IMAGE_TOOLS_OPEN_IMAGE,
        disabled: disabled.includes('openImage'),
        onClick: () => openImg(image)
      },
      {
        type: 'button',
        name: (items.length > 1) ? `${Messages.IMAGE_TOOLS_COPY_IMAGE} (PNG)` : Messages.IMAGE_TOOLS_COPY_IMAGE,
        disabled: disabled.includes('copyImage'),
        onClick: () => copyImg((images.png) ? images.png.src : url)
      },
      {
        type: 'button',
        name: Messages.OPEN_LINK,
        disabled: disabled.includes('openLink'),
        onClick: () => openUrl(url)

      },
      {
        type: 'button',
        name: Messages.COPY_LINK,
        disabled: disabled.includes('copyLink'),
        onClick: () => copyUrl(url)
      },
      {
        type: 'button',
        name: Messages.SAVE_IMAGE_MENU_ITEM,
        subtext: downloadPath,
        onClick: () => save(url)
      },
      {
        type: 'button',
        name: Messages.IMAGE_TOOLS_SAVE_IMAGE_AS,
        disabled: disabled.includes('saveAs'),
        onClick: () => saveAs(url)
      },
      {
        type: 'submenu',
        name: Messages.IMAGE_TOOLS_IMAGE_SEARCH,
        disabled: disabled.includes('searchImage'),
        items: imageSearchServices
          .filter((e) => !disabledISS.includes(e.id))
          .map((e) => ({
            type: 'button',
            name: e.name,
            subtext: e.note,
            onClick: () => openUrl((e.withoutEncode) ? e.url + url : e.url + encodeURIComponent(url))
          })),
        getItems () {
          return this.items;
        }
      }
    ];
  }

  function output (content, type, buttons) {
    const id = Math.random().toString(10).substr(2);
    powercord.api.notices.sendToast(`ImageToolsMsg-${id}`, {
      header: 'Image Tools',
      timeout: 4e3,
      content,
      type,
      buttons
    });
  }

  function success (msg) {
    const button = {
      text: 'OK',
      color: 'green',
      size: 'medium',
      look: 'outlined'
    };

    if (get('hideSuccessToasts', false)) {
      return;
    }
    output(msg, 'success', [ button ]);
  }

  function error (msg, addButton = null) {
    const buttons = [
      {
        text: 'okay',
        color: 'red',
        size: (addButton) ? 'small' : 'medium',
        look: 'outlined'
      }
    ];
    if (addButton) {
      buttons.push(addButton);
    }
    output(msg, 'danger', buttons);
  }

  async function openImg (image) {
    require('../components/ImageModal').open(image);
  }

  async function copyImg (url) {
    const { copyImage } = await getModule([ 'copyImage' ]);
    const actionButton = {
      text: Messages.COPY_LINK,
      size: 'small',
      look: 'outlined',
      onClick: () => copyUrl(url)
    };

    copyImage(url)
      .then(() => {
        success(Messages.IMAGE_TOOLS_IMAGE_COPIED);
      })
      .catch((e) => {
        error(`${Messages.IMAGE_TOOLS_CANT_COPY} \n ${Messages.IMAGE_TOOLS_NOT_HOSTING_DISCORD}`, actionButton);
        console.error(e);
      });
  }

  function openUrl (url) {
    shell.openExternal(url);
  }

  function copyUrl (url) {
    clipboard.writeText(url);
    success(Messages.IMAGE_LINK_COPIED);
  }

  async function save (url) {
    const fileName = new URL(url).pathname.split('/').pop();
    const arrayBuffer = await fetch(url)
      .then((e) => e.arrayBuffer())
      .catch((e) => {
        error(`${Messages.IMAGE_TOOLS_FAILED_TO_SAVE} \n ${Messages.IMAGE_TOOLS_NOT_HOSTING_DISCORD}`);
        console.error(e);
      });

    let num = 1;
    let pathSave = join(downloadPath, fileName);
    while (existsSync(pathSave)) {
      pathSave = join(
        downloadPath,
        fileName.replace(/(.+?)\./, `$1 (${num}).`)
      );
      num++;
    }

    if (arrayBuffer) {
      writeFile(pathSave, Buffer.from(arrayBuffer))
        .then(() => {
          success(`${Messages.IMAGE_TOOLS_IMAGE_SAVED_SUCCESSFULLY}: "${pathSave}"`);
        })
        .catch(console.error);
    }
  }

  async function saveAs (url) {
    const { saveImage } = await getModule([ 'saveImage' ]);
    saveImage(url)
      .catch((e) => {
        error(`${Messages.IMAGE_TOOLS_FAILED_TO_SAVE} \n ${Messages.IMAGE_TOOLS_NOT_HOSTING_DISCORD}`);
        console.error(e);
      });
  }
};
