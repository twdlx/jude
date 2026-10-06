const { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, TextDisplayBuilder } = require('discord.js');
const path = require('path');

function gallery(url, description) {
    return new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(url).setDescription(description));
}
function divider() {
    return new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large);
}
function buildOrderPanel() {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('orderpanel_service')
        .setPlaceholder('Select an order type')
        .addOptions(
            { label: 'Logo', value: 'logo' },
            { label: 'Banners', value: 'banners' },
            { label: 'Bundle (Both)', value: 'bundle' },
        );
    const container = new ContainerBuilder()
        .addMediaGalleryComponents(gallery('attachment://order-panel-top.png', 'Services banner'))
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Services\nBring your ideas to life with us. Our talented designers deliver fast, affordable, and high-quality solutions to turn your vision into reality. From liveries and uniforms to logos, we handle it all. When ordering you agree to our Terms of Services.'))
        .addActionRowComponents(new ActionRowBuilder().addComponents(menu))
        .addSeparatorComponents(divider())
        .addMediaGalleryComponents(gallery('attachment://order-panel-lower.png', "Jude's Studio banner"));
    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container],
        files: [
            new AttachmentBuilder(path.join(__dirname, '../assets/order-panel-top.png'), { name: 'order-panel-top.png' }),
            new AttachmentBuilder(path.join(__dirname, '../assets/order-panel-lower.png'), { name: 'order-panel-lower.png' }),
        ],
        allowedMentions: { parse: [] },
    };
}

function buildTicketMessage({ type, quantity, budget, userId }) {
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('order_claim').setLabel('Claim').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('order_edit_details').setLabel('Edit Details').setStyle(ButtonStyle.Secondary),
    );
    const container = new ContainerBuilder()
        .addMediaGalleryComponents(gallery('attachment://order-panel-top.png', 'Orders banner'))
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `Thank you for ordering with us! We are glad that you decided to order with **Jude's Studio**. Please send your **reference image(s)** in the thread below to unlock this order channel.\nAnd please keep in mind that we **do not issue refunds**.`
        ))
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## Ordering Details:\n**<:pc_people:1556974509045846130> Customer:** <@${userId}>\n**<:survey:1556974694807113761> Product Type:** ${type}\n**<:pc_checklist:1556974321434361937> Quantity:** ${quantity}\n**<:pc_robux:1556974216740470844> Budget:** ${budget}`
        ))
        .addActionRowComponents(buttons);
    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container],
        files: [new AttachmentBuilder(path.join(__dirname, '../assets/order-panel-top.png'), { name: 'order-panel-top.png' })],
        allowedMentions: { users: [userId] },
    };
}

module.exports = { buildOrderPanel, buildTicketMessage };
